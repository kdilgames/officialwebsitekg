import type { Prisma } from "@prisma/client";

import { notify } from "@/lib/audit";
import { resolveCommissionRate, splitRevenue, type CommissionRuleLike } from "@/lib/commission";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export class CheckoutError extends Error {}

export type OrderLinePreview = {
  productId: string;
  sellerId: string;
  title: string;
  slug: string;
  unitPriceMinor: number;
  currency: string;
  commissionBps: number;
  platformFeeMinor: number;
  sellerNetMinor: number;
};

export type OrderPreview = {
  lines: OrderLinePreview[];
  subtotalMinor: number;
  platformFeeMinor: number;
  sellerNetMinor: number;
  currency: string;
  issues: string[];
};

function orderNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `KD${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function activeRules(): Promise<CommissionRuleLike[]> {
  const rules = await prisma.commissionRule.findMany({
    where: { isActive: true },
    select: { scope: true, targetId: true, rateBps: true, isActive: true },
  });
  return rules;
}

/**
 * Prices a cart without writing anything. All arithmetic is done in integer
 * minor units, and every fee is derived from the stored commission rules.
 */
export async function previewCart(userId: string): Promise<OrderPreview> {
  const items = await prisma.cartItem.findMany({
    where: { cart: { userId } },
    orderBy: { createdAt: "asc" },
    select: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          priceMinor: true,
          salePriceMinor: true,
          currency: true,
          status: true,
          sellerId: true,
          categoryId: true,
          seller: {
            select: {
              id: true,
              commissionBps: true,
              status: true,
              stripeAccountId: true,
              stripeChargesEnabled: true,
              user: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  const rules = await activeRules();
  const lines: OrderLinePreview[] = [];
  const issues: string[] = [];
  let subtotalMinor = 0;
  let platformFeeMinor = 0;
  let sellerNetMinor = 0;
  let currency = "EUR";

  for (const item of items) {
    const product = item.product;

    if (product.status !== "PUBLISHED") {
      issues.push(`“${product.title}” is no longer available and will not be charged.`);
      continue;
    }
    if (product.seller.status !== "APPROVED" || product.seller.user.status !== "ACTIVE") {
      issues.push(`“${product.title}” was removed because the seller is under review.`);
      continue;
    }

    const unitPriceMinor = product.salePriceMinor ?? product.priceMinor;
    if (unitPriceMinor <= 0) {
      issues.push(`“${product.title}” has an invalid price and was skipped.`);
      continue;
    }

    currency = product.currency;

    const rate = resolveCommissionRate({
      productId: product.id,
      categoryId: product.categoryId,
      sellerId: product.sellerId,
      sellerCommissionBps: product.seller.commissionBps,
      rules,
    });
    const split = splitRevenue(unitPriceMinor, rate.rateBps);

    subtotalMinor += unitPriceMinor;
    platformFeeMinor += split.platformFeeMinor;
    sellerNetMinor += split.sellerNetMinor;

    lines.push({
      productId: product.id,
      sellerId: product.sellerId,
      title: product.title,
      slug: product.slug,
      unitPriceMinor,
      currency: product.currency,
      commissionBps: split.rateBps,
      platformFeeMinor: split.platformFeeMinor,
      sellerNetMinor: split.sellerNetMinor,
    });
  }

  return { lines, subtotalMinor, platformFeeMinor, sellerNetMinor, currency, issues };
}

/**
 * Persists a PENDING order with a frozen price and commission snapshot for each
 * line. Nothing here is trusted from the browser: prices, sellers and fees all
 * come from the database.
 */
export async function createPendingOrder(params: {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<{ orderId: string; totalMinor: number; currency: string }> {
  const preview = await previewCart(params.userId);

  if (preview.lines.length === 0) {
    throw new CheckoutError("Your cart is empty.");
  }

  const blocked = await prisma.orderItem.findMany({
    where: {
      productId: { in: preview.lines.map((line) => line.productId) },
      order: { buyerId: params.userId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    },
    select: { product: { select: { title: true } } },
  });
  if (blocked.length > 0) {
    throw new CheckoutError(
      `You already own ${blocked.map((item) => `“${item.product.title}”`).join(", ")}. Remove it from the cart first.`,
    );
  }

  const order = await prisma.order.create({
    data: {
      orderNumber: orderNumber(),
      buyerId: params.userId,
      status: "PENDING",
      currency: preview.currency,
      subtotalMinor: preview.subtotalMinor,
      totalMinor: preview.subtotalMinor,
      platformFeeMinor: preview.platformFeeMinor,
      sellerNetMinor: preview.sellerNetMinor,
      isTestMode: true,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      items: {
        create: preview.lines.map((line) => ({
          productId: line.productId,
          sellerId: line.sellerId,
          titleSnapshot: line.title,
          priceMinor: line.unitPriceMinor,
          quantity: 1,
          commissionBps: line.commissionBps,
          platformFeeMinor: line.platformFeeMinor,
          sellerNetMinor: line.sellerNetMinor,
          currency: line.currency,
          status: "PENDING",
        })),
      },
      payment: {
        create: {
          provider: "STRIPE",
          amountMinor: preview.subtotalMinor,
          currency: preview.currency,
          status: "REQUIRES_PAYMENT",
        },
      },
    },
    select: { id: true, totalMinor: true, currency: true },
  });

  return { orderId: order.id, totalMinor: order.totalMinor, currency: order.currency };
}

/**
 * Creates the Stripe Checkout Session for a pending order.
 *
 * The buyer is charged once on the platform account. Marketplace funds are then
 * moved to each seller as a Stripe Transfer when their earnings become payable,
 * which is the documented Stripe Connect "separate charges and transfers" model
 * for carts that span multiple sellers. The platform never keeps a stored
 * balance of its own: pending earnings are a ledger of what Stripe owes, not a
 * wallet the marketplace can spend.
 */
export async function createCheckoutSession(params: {
  orderId: string;
  stripe: import("stripe").default;
  successUrl: string;
  cancelUrl: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      orderNumber: true,
      currency: true,
      totalMinor: true,
      buyer: { select: { email: true } },
      items: {
        select: {
          titleSnapshot: true,
          priceMinor: true,
        },
      },
    },
  });

  if (!order) throw new CheckoutError("Order not found.");

  const session = await params.stripe.checkout.sessions.create({
    mode: "payment",
    // The platform is the merchant of record for the charge; sellers are paid
    // out through Transfers once their earnings clear the hold period.
    customer_email: order.buyer.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
    payment_intent_data: {
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      setup_future_usage: undefined,
    },
    line_items: order.items.map((item) => ({
      quantity: 1,
      price_data: {
        currency: order.currency.toLowerCase(),
        unit_amount: item.priceMinor,
        product_data: { name: item.titleSnapshot },
      },
    })),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id, status: "PENDING" },
    }),
    prisma.payment.update({
      where: { orderId: order.id },
      data: { providerRef: session.id, status: "PROCESSING" },
    }),
  ]);

  return session;
}

/**
 * Applies a successfully paid order exactly once. Called from the verified
 * Stripe webhook; the caller guarantees idempotency through WebhookEvent.
 */
export async function markOrderPaid(params: {
  orderId: string;
  paymentIntentId: string | null;
  receiptUrl: string | null;
  isTestMode: boolean;
}): Promise<{ alreadyPaid: boolean }> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      status: true,
      currency: true,
      buyerId: true,
      sellerNetMinor: true,
      items: {
        select: {
          id: true,
          productId: true,
          sellerId: true,
          priceMinor: true,
          platformFeeMinor: true,
          sellerNetMinor: true,
          status: true,
        },
      },
    },
  });

  if (!order) throw new CheckoutError("Order not found.");
  if (order.status === "PAID" || order.status === "PARTIALLY_REFUNDED") {
    return { alreadyPaid: true };
  }

  const availableAt = new Date(
    Date.now() + env.marketplace.earningsHoldDays * 24 * 60 * 60 * 1000,
  );
  const holdDays = env.marketplace.earningsHoldDays;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        stripePaymentIntentId: params.paymentIntentId,
        receiptUrl: params.receiptUrl,
        isTestMode: params.isTestMode,
      },
    });

    await tx.orderItem.updateMany({
      where: { orderId: order.id },
      data: { status: "PAID" },
    });

    await tx.payment.update({
      where: { orderId: order.id },
      data: {
        status: "SUCCEEDED",
        succeededAt: new Date(),
        providerRef: params.paymentIntentId ?? undefined,
      },
    });

    for (const item of order.items) {
      // One earning row per order line; the unique orderItemId constraint makes
      // a duplicate webhook delivery a no-op.
      await tx.sellerEarning.upsert({
        where: { orderItemId: item.id },
        update: {},
        create: {
          sellerId: item.sellerId,
          orderId: order.id,
          orderItemId: item.id,
          currency: order.currency,
          grossMinor: item.priceMinor,
          platformFeeMinor: item.platformFeeMinor,
          netMinor: item.sellerNetMinor,
          status: "PENDING",
          availableAt,
        },
      });

      await tx.product.update({
        where: { id: item.productId },
        data: { salesCount: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cart: { userId: order.buyerId } } });
  });

  const sellerIds = [...new Set(order.items.map((item) => item.sellerId))];
  const sellers = await prisma.sellerProfile.findMany({
    where: { id: { in: sellerIds } },
    select: { userId: true, storeName: true },
  });
  for (const seller of sellers) {
    await notify({
      userId: seller.userId,
      type: "ORDER",
      title: "You made a sale",
      body: `Your earnings become available in ${holdDays} day${holdDays === 1 ? "" : "s"}.`,
      href: "/dashboard/orders",
    });
  }

  return { alreadyPaid: false };
}

/** Marks an order reversed after a full refund or a lost dispute. */
export async function markOrderReversed(params: {
  orderId: string;
  status: "REFUNDED" | "DISPUTED" | "PARTIALLY_REFUNDED";
  refundedMinor?: number;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: params.orderId },
      data: {
        status: params.status,
        refundedAt: params.status === "DISPUTED" ? undefined : new Date(),
      },
    });

    if (params.status === "REFUNDED") {
      await tx.orderItem.updateMany({
        where: { orderId: params.orderId },
        data: { status: "REFUNDED" },
      });
      await tx.sellerEarning.updateMany({
        where: { orderId: params.orderId, status: { in: ["PENDING", "AVAILABLE"] } },
        data: { status: "REVERSED", reversedAt: new Date(), reversalReason: "Order refunded" },
      });
    }
  });
}

export type { Prisma };
