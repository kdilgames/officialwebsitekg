import { notify } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ConnectError } from "@/lib/payments/connect";
import { getStripe } from "@/lib/stripe";

/**
 * Refund workflow.
 *
 * A buyer can only *request* a refund; money is only ever returned to a card by
 * an administrator, and only through Stripe. The marketplace never marks a
 * refund as paid by itself — `charge.refunded` is the authoritative signal and
 * it is applied in the webhook handler.
 */
export class RefundError extends Error {}

const OPEN_STATUSES = ["REQUESTED", "APPROVED", "PROCESSING"] as const;

export async function submitRefundRequest(params: {
  orderId: string;
  orderItemId?: string | null;
  requesterId: string;
  reason: string;
}): Promise<{ refundId: string }> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      buyerId: true,
      status: true,
      currency: true,
      totalMinor: true,
      items: {
        select: { id: true, priceMinor: true, refundedMinor: true, titleSnapshot: true },
      },
    },
  });

  if (!order) throw new RefundError("Order not found.");
  if (order.buyerId !== params.requesterId) {
    throw new RefundError("That order does not belong to your account.");
  }
  if (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED") {
    throw new RefundError("Only a paid order can be refunded.");
  }

  const item = params.orderItemId
    ? order.items.find((candidate) => candidate.id === params.orderItemId)
    : null;
  if (params.orderItemId && !item) {
    throw new RefundError("That item is not part of this order.");
  }

  const alreadyOpen = await prisma.refund.count({
    where: { orderId: order.id, status: { in: [...OPEN_STATUSES] } },
  });
  if (alreadyOpen > 0) {
    throw new RefundError("A refund for this order is already being handled.");
  }

  // The amount is derived from stored line prices, never from the request body.
  const amountMinor = item ? item.priceMinor - item.refundedMinor : order.totalMinor;
  if (amountMinor <= 0) {
    throw new RefundError("There is nothing left to refund on this order.");
  }

  const refund = await prisma.refund.create({
    data: {
      orderId: order.id,
      orderItemId: item?.id ?? null,
      amountMinor,
      currency: order.currency,
      reason: params.reason,
      status: "REQUESTED",
      requestedById: params.requesterId,
    },
    select: { id: true },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "ORDER",
      title: "Refund requested",
      body: `${formatMoney(amountMinor, order.currency)} for “${item?.titleSnapshot ?? "an order"}”.`,
      href: "/admin/refunds",
    });
  }

  return { refundId: refund.id };
}

/** Records the platform decision. No money moves here. */
export async function decideRefundRequest(params: {
  refundId: string;
  adminId: string;
  decision: "APPROVED" | "REJECTED";
  adminNote?: string | null;
}): Promise<void> {
  const refund = await prisma.refund.findUnique({
    where: { id: params.refundId },
    select: {
      id: true,
      status: true,
      amountMinor: true,
      currency: true,
      requestedById: true,
    },
  });

  if (!refund) throw new RefundError("Refund not found.");
  if (refund.status !== "REQUESTED") {
    throw new RefundError(`This request is already ${refund.status.toLowerCase()}.`);
  }

  await prisma.refund.update({
    where: { id: refund.id },
    data: {
      status: params.decision,
      adminNote: params.adminNote ?? null,
      processedAt: params.decision === "REJECTED" ? new Date() : null,
    },
  });

  if (refund.requestedById) {
    await notify({
      userId: refund.requestedById,
      type: "ORDER",
      title: params.decision === "APPROVED" ? "Refund approved" : "Refund declined",
      body: [
        formatMoney(refund.amountMinor, refund.currency),
        params.adminNote?.trim(),
      ]
        .filter((part): part is string => Boolean(part))
        .join(" — "),
      href: "/account/orders",
    });
  }
}

/**
 * Sends an approved refund to Stripe.
 *
 * The idempotency key is derived from the refund row, so a double submission
 * cannot return the money twice. The row is left in PROCESSING until the
 * verified `charge.refunded` webhook confirms it.
 */
export async function executeRefund(params: {
  refundId: string;
  adminId: string;
}): Promise<{ stripeRefundId: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new ConnectError(
      "Stripe is not configured, so no refund can be sent. Refunds are never simulated.",
    );
  }

  const refund = await prisma.refund.findUnique({
    where: { id: params.refundId },
    select: {
      id: true,
      status: true,
      amountMinor: true,
      orderId: true,
      orderItemId: true,
      order: { select: { stripePaymentIntentId: true } },
    },
  });

  if (!refund) throw new RefundError("Refund not found.");
  if (refund.status !== "APPROVED") {
    throw new RefundError("Only an approved refund can be sent to Stripe.");
  }
  if (!refund.order.stripePaymentIntentId) {
    throw new RefundError("This order has no Stripe payment to refund.");
  }

  const created = await stripe.refunds.create(
    {
      payment_intent: refund.order.stripePaymentIntentId,
      amount: refund.amountMinor,
      metadata: { refundId: refund.id, orderId: refund.orderId },
    },
    { idempotencyKey: `refund:${refund.id}` },
  );

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: { status: "PROCESSING", stripeRefundId: created.id },
    });

    if (refund.orderItemId) {
      // Track the refunded portion so the seller dashboard stops claiming the
      // reversed part of the sale. A fully refunded line is marked REFUNDED and
      // its earning is reversed here; the webhook repeats this idempotently.
      const item = await tx.orderItem.update({
        where: { id: refund.orderItemId },
        data: { refundedMinor: { increment: refund.amountMinor } },
        select: { id: true, priceMinor: true, refundedMinor: true },
      });

      if (item.refundedMinor >= item.priceMinor) {
        await tx.orderItem.update({ where: { id: item.id }, data: { status: "REFUNDED" } });
        await tx.sellerEarning.updateMany({
          where: { orderItemId: item.id, status: { in: ["PENDING", "AVAILABLE"] } },
          data: { status: "REVERSED", reversedAt: new Date(), reversalReason: "Order refunded" },
        });
      }
    }
  });

  return { stripeRefundId: created.id };
}

/** Marks a refund that Stripe refused, so the ledger never claims it succeeded. */
export async function failRefund(params: {
  refundId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  const refund = await prisma.refund.findUnique({
    where: { id: params.refundId },
    select: { id: true, status: true },
  });
  if (!refund) throw new RefundError("Refund not found.");
  if (refund.status === "PROCESSED") {
    throw new RefundError("This refund has already been processed by Stripe.");
  }

  await prisma.refund.update({
    where: { id: refund.id },
    data: { status: "FAILED", adminNote: params.reason, processedAt: new Date() },
  });
}
