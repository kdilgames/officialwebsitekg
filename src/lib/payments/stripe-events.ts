import type Stripe from "stripe";

import { prisma } from "@/lib/db";
import { markOrderPaid, markOrderReversed } from "@/lib/payments/orders";

export type EventOutcome = {
  status: "PROCESSED" | "IGNORED";
  detail?: string;
};

function orderIdFromSession(session: Stripe.Checkout.Session): string | null {
  const fromMetadata = session.metadata?.orderId;
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) return fromMetadata;
  return session.client_reference_id ?? null;
}

function paymentIntentId(value: Stripe.Checkout.Session["payment_intent"]): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Best-effort receipt lookup; a missing receipt must never block the payment record. */
async function receiptUrlFor(stripe: Stripe, intentId: string | null): Promise<string | null> {
  if (!intentId) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
    const charge = intent.latest_charge;
    if (charge && typeof charge !== "string") return charge.receipt_url ?? null;
  } catch {
    return null;
  }
  return null;
}

/**
 * Records a paid Checkout Session against the order it was created for.
 *
 * The order is resolved from the metadata we set when creating the session, and
 * the session must be the one already stored on that order, so a replayed or
 * forged event cannot settle a different order. `markOrderPaid` is idempotent.
 */
export async function applyCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<EventOutcome> {
  const orderId = orderIdFromSession(session);
  if (!orderId) return { status: "IGNORED", detail: "Session carries no order reference." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, stripeCheckoutSessionId: true },
  });
  if (!order) return { status: "IGNORED", detail: "Order not found." };
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    return { status: "IGNORED", detail: "Session does not belong to this order." };
  }
  if (session.payment_status !== "paid") {
    return { status: "IGNORED", detail: `Session payment status is "${session.payment_status}".` };
  }

  const intentId = paymentIntentId(session.payment_intent);
  const receiptUrl = await receiptUrlFor(stripe, intentId);

  const result = await markOrderPaid({
    orderId: order.id,
    paymentIntentId: intentId,
    receiptUrl,
    // Never infer live mode from the client: the session itself reports it.
    isTestMode: session.livemode === false,
  });

  return {
    status: "PROCESSED",
    detail: result.alreadyPaid ? "Order was already marked paid." : undefined,
  };
}

/** Abandoned checkout: only a still-pending order is canceled. */
async function applyCheckoutExpired(session: Stripe.Checkout.Session): Promise<EventOutcome> {
  const orderId = orderIdFromSession(session);
  if (!orderId) return { status: "IGNORED" };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order || order.status !== "PENDING") {
    return { status: "IGNORED", detail: "No pending order to cancel." };
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELED", canceledAt: new Date() },
    }),
    prisma.payment.update({ where: { orderId: order.id }, data: { status: "CANCELED" } }),
  ]);

  return { status: "PROCESSED" };
}

async function applyPaymentFailed(intent: Stripe.PaymentIntent): Promise<EventOutcome> {
  const orderId = typeof intent.metadata?.orderId === "string" ? intent.metadata.orderId : null;
  if (!orderId) return { status: "IGNORED" };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order || order.status !== "PENDING") {
    return { status: "IGNORED", detail: "Order is not awaiting payment." };
  }

  await prisma.payment.update({
    where: { orderId: order.id },
    data: {
      status: "FAILED",
      providerRef: intent.id,
      failureReason: intent.last_payment_error?.message ?? "The payment was declined.",
    },
  });

  return { status: "PROCESSED" };
}

async function applyChargeRefunded(charge: Stripe.Charge): Promise<EventOutcome> {
  const intentId = idOf(charge.payment_intent);
  if (!intentId) return { status: "IGNORED" };

  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: intentId },
    select: { id: true, totalMinor: true, status: true },
  });
  if (!order) return { status: "IGNORED", detail: "No order for this payment intent." };

  const refundedMinor = charge.amount_refunded ?? 0;
  const status = refundedMinor >= order.totalMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";
  if (order.status === status || order.status === "REFUNDED") {
    return { status: "IGNORED", detail: "Refund already recorded." };
  }

  await markOrderReversed({ orderId: order.id, status, refundedMinor });

  // Close any open refund request for this order. The Stripe refund id is only
  // attached when a single request maps onto it, because the column is unique.
  const open = await prisma.refund.findMany({
    where: { orderId: order.id, status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
    select: { id: true },
  });
  const stripeRefundId = charge.refunds?.data?.[0]?.id ?? null;
  if (open.length > 0) {
    await prisma.refund.updateMany({
      where: { id: { in: open.map((row) => row.id) } },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        ...(stripeRefundId && open.length === 1 ? { stripeRefundId } : {}),
      },
    });
  }

  return { status: "PROCESSED" };
}

function mapDisputeStatus(status: Stripe.Dispute.Status): "NEEDS_RESPONSE" | "UNDER_REVIEW" | "WON" | "LOST" | "WARNING_CLOSED" {
  switch (status) {
    case "won":
      return "WON";
    case "lost":
      return "LOST";
    case "under_review":
      return "UNDER_REVIEW";
    case "warning_closed":
    case "charge_refunded":
      return "WARNING_CLOSED";
    default:
      return "NEEDS_RESPONSE";
  }
}

async function applyDisputeCreated(dispute: Stripe.Dispute): Promise<EventOutcome> {
  const intentId = idOf(dispute.payment_intent);
  if (!intentId) return { status: "IGNORED" };

  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: intentId },
    select: { id: true, currency: true },
  });
  if (!order) return { status: "IGNORED", detail: "No order for this payment intent." };

  const dueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000)
    : null;
  const data = {
    amountMinor: dispute.amount,
    currency: (dispute.currency ?? order.currency).toUpperCase(),
    reason: dispute.reason ?? "unknown",
    status: mapDisputeStatus(dispute.status),
    evidenceDueBy: dueBy,
  };

  await prisma.$transaction([
    prisma.dispute.upsert({
      where: { stripeDisputeId: dispute.id },
      update: data,
      create: { orderId: order.id, stripeDisputeId: dispute.id, ...data },
    }),
    prisma.order.update({ where: { id: order.id }, data: { status: "DISPUTED" } }),
  ]);

  return { status: "PROCESSED" };
}

/** Connect onboarding progress: mirrors Stripe's verification flags onto the seller. */
async function applyAccountUpdated(account: Stripe.Account): Promise<EventOutcome> {
  const seller = await prisma.sellerProfile.findUnique({
    where: { stripeAccountId: account.id },
    select: { id: true },
  });
  if (!seller) return { status: "IGNORED", detail: "Not a marketplace seller account." };

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: {
      stripeChargesEnabled: Boolean(account.charges_enabled),
      stripePayoutsEnabled: Boolean(account.payouts_enabled),
      stripeDetailsSubmitted: Boolean(account.details_submitted),
    },
  });

  if (account.details_submitted) {
    await prisma.sellerProfile.updateMany({
      where: { id: seller.id, stripeOnboardedAt: null },
      data: { stripeOnboardedAt: new Date() },
    });
  }

  return { status: "PROCESSED" };
}

/**
 * Applies a verified Stripe event. The caller persists the event first, so a
 * retried delivery never reaches this function twice.
 */
export async function handleStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<EventOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return applyCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
    case "checkout.session.expired":
      return applyCheckoutExpired(event.data.object as Stripe.Checkout.Session);
    case "payment_intent.payment_failed":
      return applyPaymentFailed(event.data.object as Stripe.PaymentIntent);
    case "charge.refunded":
      return applyChargeRefunded(event.data.object as Stripe.Charge);
    case "charge.dispute.created":
    case "charge.dispute.updated":
      return applyDisputeCreated(event.data.object as Stripe.Dispute);
    case "account.updated":
      return applyAccountUpdated(event.data.object as Stripe.Account);
    default:
      return { status: "IGNORED", detail: `Unhandled event type ${event.type}.` };
  }
}

/**
 * Server-side reconciliation for the checkout return page: the browser hands
 * back a session id, and the truth is read from Stripe, never from the client.
 */
export async function reconcileCheckoutSession(
  stripe: Stripe,
  params: { sessionId: string; buyerId: string },
): Promise<EventOutcome> {
  const session = await stripe.checkout.sessions.retrieve(params.sessionId);

  const orderId = orderIdFromSession(session);
  if (!orderId) return { status: "IGNORED", detail: "Session carries no order reference." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, buyerId: true },
  });
  if (!order || order.buyerId !== params.buyerId) {
    return { status: "IGNORED", detail: "Order does not belong to this account." };
  }

  if (session.payment_status !== "paid") {
    return { status: "IGNORED", detail: "Stripe has not confirmed this payment yet." };
  }

  return applyCheckoutCompleted(stripe, session);
}
