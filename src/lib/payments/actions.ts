"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, formToObject, successState, toFieldErrors, type ActionState } from "@/lib/action-state";
import { getRequestContext, recordAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import {
  CheckoutError,
  createCheckoutSession,
  createPendingOrder,
  previewCart,
} from "@/lib/payments/orders";
import { RefundError, submitRefundRequest } from "@/lib/payments/refunds";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { refundRequestSchema } from "@/lib/validation";

/**
 * Starts a Stripe Checkout Session for the current cart.
 *
 * The order is only created once Stripe is known to be configured, so a missing
 * key results in an explicit error rather than a "successful" purchase. Amounts,
 * sellers and commissions all come from the database, never from the request.
 */
export async function startCheckoutAction(
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fcart");

  const stripe = getStripe();
  if (!stripe) {
    return errorState(
      "Payments are not configured on this deployment yet, so nothing has been charged and no order was created. An administrator must provide Stripe Connect credentials.",
    );
  }

  const limit = await rateLimit(`checkout:${user.id}`, 10, 60 * 10);
  if (!limit.ok) {
    return errorState("Too many checkout attempts. Please wait a moment and try again.");
  }

  const preview = await previewCart(user.id);
  if (preview.lines.length === 0) {
    return errorState("Your cart is empty.");
  }

  const context = await getRequestContext();

  let order: { orderId: string; totalMinor: number; currency: string };
  try {
    order = await createPendingOrder({
      userId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch (error) {
    if (error instanceof CheckoutError) return errorState(error.message);
    throw error;
  }

  // Returning to the cart keeps the order reusable; Stripe sends the buyer back
  // with the session id, which the success page verifies server-side.
  const successUrl = `${env.siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${env.siteUrl}/checkout/cancel?order=${order.orderId}`;

  let checkoutUrl: string;
  try {
    const session = await createCheckoutSession({
      orderId: order.orderId,
      stripe,
      successUrl,
      cancelUrl,
    });

    if (!session.url) {
      throw new CheckoutError("Stripe did not return a checkout URL.");
    }

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "order.checkout_started",
      entityType: "Order",
      entityId: order.orderId,
      after: { amountMinor: order.totalMinor, currency: order.currency, sessionId: session.id },
    });

    checkoutUrl = session.url;
  } catch (error) {
    if (error instanceof CheckoutError) return errorState(error.message);
    if (error instanceof Error) {
      return errorState(`Stripe rejected the checkout session: ${error.message}`);
    }
    throw error;
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  // Outside the try block: redirect() signals by throwing, which must not be caught.
  redirect(checkoutUrl);
}

/**
 * Files a refund request against one of the caller's own paid orders.
 *
 * This only records the request: the amount is derived from the stored order
 * lines inside `submitRefundRequest`, and no money moves until an administrator
 * approves it and the payment provider confirms the reversal.
 */
export async function requestRefundAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Faccount%2Forders");

  const parsed = refundRequestSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const limit = await rateLimit(`refund:${user.id}`, 5, 60 * 60);
  if (!limit.ok) {
    return errorState(
      "You have filed several refund requests recently. Please wait before filing another, or reply on an existing ticket.",
    );
  }

  let refundId: string;
  try {
    const result = await submitRefundRequest({
      orderId: parsed.data.orderId,
      orderItemId: parsed.data.orderItemId ?? null,
      requesterId: user.id,
      reason: parsed.data.reason,
    });
    refundId = result.refundId;
  } catch (error) {
    if (error instanceof RefundError) return errorState(error.message);
    throw error;
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "refund.requested",
    entityType: "Refund",
    entityId: refundId,
    after: { orderId: parsed.data.orderId },
  });

  revalidatePath("/account/orders");
  revalidatePath("/admin/refunds");
  return successState(
    "Refund requested. Platform staff will review the order and record their decision here.",
  );
}
