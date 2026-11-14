import type { Prisma } from "@prisma/client";

import { notify } from "@/lib/audit";
import { resolveCommissionRate, splitRevenue, type CommissionRuleLike } from "@/lib/commission";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { env } from "@/lib/env";
import {
  allocateMinorProportionally,
  evaluateCouponForLines,
  STRIPE_MIN_CHARGE_MINOR,
} from "@/lib/payments/pricing";

export class CheckoutError extends Error {}

export type OrderLinePreview = {
  productId: string;
  sellerId: string;
  title: string;
  slug: string;
  originalUnitPriceMinor: number;
  unitPriceMinor: number;
  currency: string;
  commissionBps: number;
  platformFeeMinor: number;
  sellerNetMinor: number;
  bundleTitle?: string | null;
};

export type OrderPreview = {
  lines: OrderLinePreview[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  platformFeeMinor: number;
  sellerNetMinor: number;
  currency: string;
  coupon: { id: string; code: string; discountMinor: number } | null;
  couponError: string | null;
  issues: string[];
};

function orderNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `KD${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function activeRules(): Promise<CommissionRuleLike[]> {
  return prisma.commissionRule.findMany({
    where: { isActive: true },
    select: { scope: true, targetId: true, rateBps: true, isActive: true },
  });
}

type RawCartLine = {
  productId: string;
  sellerId: string;
  categoryId: string;
  sellerCommissionBps: number | null;
  title: string;
  slug: string;
  unitPriceMinor: number;
  currency: string;
  bundleTitle: string | null;
};

/**
 * Prices a cart without writing anything. Expands bundles, de-duplicates
 * overlapping items cleanly, evaluates active promo codes, and derives every
 * fee in integer minor units from stored commission rules.
 */
export async function previewCart(userId: string): Promise<OrderPreview> {
  const cartItemsSelect = {
    orderBy: { createdAt: "asc" as const },
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
              userId: true,
              commissionBps: true,
              status: true,
              user: { select: { status: true } },
            },
          },
        },
      },
    },
  };

  const [cart, ownedRows, rules] = await Promise.all([
    withSchemaFallback(
      () =>
        prisma.cart.findUnique({
          where: { userId },
          select: {
            couponCode: true,
            items: cartItemsSelect,
            bundles: {
              orderBy: { createdAt: "asc" },
              select: {
                bundle: {
                  select: {
                    id: true,
                    title: true,
                    bundlePriceMinor: true,
                    currency: true,
                    isActive: true,
                    sellerId: true,
                    seller: {
                      select: {
                        id: true,
                        userId: true,
                        commissionBps: true,
                        status: true,
                        user: { select: { status: true } },
                      },
                    },
                    items: {
                      orderBy: { sortOrder: "asc" },
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
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      async () => {
        const legacy = await prisma.cart.findUnique({
          where: { userId },
          select: { items: cartItemsSelect },
        });
        return legacy ? { couponCode: null as string | null, items: legacy.items, bundles: [] } : null;
      },
    ),
    prisma.orderItem.findMany({
      where: {
        order: { buyerId: userId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
      },
      select: { productId: true },
    }),
    activeRules(),
  ]);

  if (!cart) {
    return {
      lines: [],
      subtotalMinor: 0,
      discountMinor: 0,
      totalMinor: 0,
      platformFeeMinor: 0,
      sellerNetMinor: 0,
      currency: "EUR",
      coupon: null,
      couponError: null,
      issues: [],
    };
  }

  const ownedIds = new Set(ownedRows.map((row) => row.productId));
  const includedProductIds = new Set<string>();
  const rawLines: RawCartLine[] = [];
  const issues: string[] = [];
  let currency: string | null = null;

  // 1. Expand bundles first so bundle pricing wins over overlapping individual items.
  for (const entry of cart.bundles) {
    const bundle = entry.bundle;
    if (
      !bundle.isActive ||
      bundle.seller.status !== "APPROVED" ||
      bundle.seller.user.status !== "ACTIVE"
    ) {
      issues.push(`Bundle “${bundle.title}” is no longer available and will not be charged.`);
      continue;
    }
    if (bundle.seller.userId === userId) {
      issues.push(`Bundle “${bundle.title}” belongs to your own store and was skipped.`);
      continue;
    }

    const bundleProducts = bundle.items.map((item) => item.product);
    if (
      bundleProducts.length === 0 ||
      bundleProducts.some((product) => product.status !== "PUBLISHED")
    ) {
      issues.push(
        `Bundle “${bundle.title}” contains unavailable products and will not be charged.`,
      );
      continue;
    }

    if (currency !== null && bundle.currency !== currency) {
      issues.push(
        `Bundle “${bundle.title}” uses ${bundle.currency}, which cannot mix with ${currency} in one checkout.`,
      );
      continue;
    }

    const eligibleProducts = bundleProducts.filter(
      (product) => !ownedIds.has(product.id) && !includedProductIds.has(product.id),
    );
    if (eligibleProducts.length === 0) {
      issues.push(
        `All products in bundle “${bundle.title}” are already owned or in another bundle.`,
      );
      continue;
    }
    if (eligibleProducts.length < bundleProducts.length) {
      issues.push(
        `Some items in bundle “${bundle.title}” are already in your library; remaining items stay included.`,
      );
    }

    currency ??= bundle.currency;

    const weights = eligibleProducts.map((product) => product.salePriceMinor ?? product.priceMinor);
    const allocatedPrices = allocateMinorProportionally(weights, bundle.bundlePriceMinor);

    eligibleProducts.forEach((product, idx) => {
      includedProductIds.add(product.id);
      rawLines.push({
        productId: product.id,
        sellerId: product.sellerId,
        categoryId: product.categoryId,
        sellerCommissionBps: bundle.seller.commissionBps,
        title: product.title,
        slug: product.slug,
        unitPriceMinor: allocatedPrices[idx] ?? 0,
        currency: bundle.currency,
        bundleTitle: bundle.title,
      });
    });
  }

  // 2. Process individual cart items.
  for (const item of cart.items) {
    const product = item.product;

    if (includedProductIds.has(product.id)) {
      issues.push(`“${product.title}” is already included in a bundle in your cart.`);
      continue;
    }
    if (product.status !== "PUBLISHED") {
      issues.push(`“${product.title}” is no longer available and will not be charged.`);
      continue;
    }
    if (product.seller.status !== "APPROVED" || product.seller.user.status !== "ACTIVE") {
      issues.push(`“${product.title}” was removed because the seller is under review.`);
      continue;
    }
    if (product.seller.userId === userId) {
      issues.push(`“${product.title}” belongs to your own store and was skipped.`);
      continue;
    }
    if (ownedIds.has(product.id)) {
      issues.push(`You already own “${product.title}”, so it will not be charged again.`);
      continue;
    }

    const unitPriceMinor = product.salePriceMinor ?? product.priceMinor;
    if (unitPriceMinor < 0) {
      issues.push(`“${product.title}” has an invalid price and was skipped.`);
      continue;
    }

    if (currency !== null && product.currency !== currency) {
      issues.push(
        `“${product.title}” uses ${product.currency}, which cannot mix with ${currency} in one checkout.`,
      );
      continue;
    }
    currency ??= product.currency;

    includedProductIds.add(product.id);
    rawLines.push({
      productId: product.id,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      sellerCommissionBps: product.seller.commissionBps,
      title: product.title,
      slug: product.slug,
      unitPriceMinor,
      currency: product.currency,
      bundleTitle: null,
    });
  }

  const effectiveCurrency = currency ?? "EUR";
  const subtotalMinor = rawLines.reduce((sum, line) => sum + line.unitPriceMinor, 0);

  // 3. Evaluate cart promo code if attached.
  let couponSummary: { id: string; code: string; discountMinor: number } | null = null;
  let couponError: string | null = null;
  let lineDiscounts = rawLines.map(() => 0);

  if (cart.couponCode && rawLines.length > 0) {
    const normalizedCode = cart.couponCode.trim().toUpperCase();
    const couponRow = await prisma.coupon.findUnique({
      where: { code: normalizedCode },
      select: {
        id: true,
        code: true,
        sellerId: true,
        discountType: true,
        percentOff: true,
        amountOffMinor: true,
        currency: true,
        minSubtotalMinor: true,
        maxRedemptions: true,
        redemptionCount: true,
        isActive: true,
        expiresAt: true,
      },
    });

    if (!couponRow) {
      couponError = `Promo code “${normalizedCode}” does not exist.`;
    } else {
      const evaluated = evaluateCouponForLines({
        lines: rawLines,
        coupon: couponRow,
        cartCurrency: effectiveCurrency,
      });
      if (evaluated.valid) {
        lineDiscounts = evaluated.lineDiscounts;
        couponSummary = {
          id: evaluated.couponId,
          code: evaluated.code,
          discountMinor: evaluated.discountMinor,
        };
      } else {
        couponError = evaluated.reason;
      }
    }
  }

  const lines: OrderLinePreview[] = [];
  let totalMinor = 0;
  let platformFeeMinor = 0;
  let sellerNetMinor = 0;

  rawLines.forEach((raw, index) => {
    const discount = lineDiscounts[index] ?? 0;
    const discountedUnitPrice = Math.max(0, raw.unitPriceMinor - discount);

    const rate = resolveCommissionRate({
      productId: raw.productId,
      categoryId: raw.categoryId,
      sellerId: raw.sellerId,
      sellerCommissionBps: raw.sellerCommissionBps,
      rules,
    });
    const split = splitRevenue(discountedUnitPrice, rate.rateBps);

    totalMinor += discountedUnitPrice;
    platformFeeMinor += split.platformFeeMinor;
    sellerNetMinor += split.sellerNetMinor;

    lines.push({
      productId: raw.productId,
      sellerId: raw.sellerId,
      title: raw.title,
      slug: raw.slug,
      originalUnitPriceMinor: raw.unitPriceMinor,
      unitPriceMinor: discountedUnitPrice,
      currency: raw.currency,
      commissionBps: split.rateBps,
      platformFeeMinor: split.platformFeeMinor,
      sellerNetMinor: split.sellerNetMinor,
      bundleTitle: raw.bundleTitle,
    });
  });

  const discountMinor = couponSummary?.discountMinor ?? 0;

  return {
    lines,
    subtotalMinor,
    discountMinor,
    totalMinor,
    platformFeeMinor,
    sellerNetMinor,
    currency: effectiveCurrency,
    coupon: couponSummary,
    couponError,
    issues,
  };
}

/**
 * Persists a PENDING order for a positive checkout total with frozen prices,
 * applied promo coupon snapshot, and commission splits.
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

  if (preview.totalMinor > 0 && preview.totalMinor < STRIPE_MIN_CHARGE_MINOR) {
    throw new CheckoutError(
      `Stripe requires positive checkouts to total at least 0.50 ${preview.currency}.`,
    );
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
      discountMinor: preview.discountMinor,
      totalMinor: preview.totalMinor,
      platformFeeMinor: preview.platformFeeMinor,
      sellerNetMinor: preview.sellerNetMinor,
      ...(preview.coupon
        ? { couponId: preview.coupon.id, couponCodeSnapshot: preview.coupon.code }
        : {}),
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
          amountMinor: preview.totalMinor,
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
 * Atomically claims a €0 cart (free products and/or 100%-off promo code)
 * without touching Stripe, unlocking downloads immediately.
 */
export async function claimFreeOrderFromCart(params: {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<{ orderId: string; couponCode: string | null }> {
  const preview = await previewCart(params.userId);
  if (preview.lines.length === 0) {
    throw new CheckoutError("Your cart is empty.");
  }
  if (preview.totalMinor !== 0) {
    throw new CheckoutError("This cart has a positive balance and requires Stripe checkout.");
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
      `You already own ${blocked.map((item) => `“${item.product.title}”`).join(", ")}.`,
    );
  }

  const orderId = await prisma.$transaction(async (tx) => {
    if (preview.coupon) {
      const coupon = await tx.coupon.findUnique({
        where: { id: preview.coupon.id },
        select: { id: true, isActive: true, maxRedemptions: true, redemptionCount: true },
      });
      if (
        !coupon ||
        !coupon.isActive ||
        (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions)
      ) {
        throw new CheckoutError("That promo code is no longer valid or has reached its limit.");
      }
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { redemptionCount: { increment: 1 } },
      });
    }

    const now = new Date();
    const created = await tx.order.create({
      data: {
        orderNumber: orderNumber(),
        buyerId: params.userId,
        status: "PAID",
        paidAt: now,
        currency: preview.currency,
        subtotalMinor: preview.subtotalMinor,
        discountMinor: preview.discountMinor,
        totalMinor: 0,
        platformFeeMinor: 0,
        sellerNetMinor: 0,
        ...(preview.coupon
          ? { couponId: preview.coupon.id, couponCodeSnapshot: preview.coupon.code }
          : {}),
        isTestMode: false,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        items: {
          create: preview.lines.map((line) => ({
            productId: line.productId,
            sellerId: line.sellerId,
            titleSnapshot: line.title,
            priceMinor: 0,
            quantity: 1,
            commissionBps: line.commissionBps,
            platformFeeMinor: 0,
            sellerNetMinor: 0,
            currency: line.currency,
            status: "PAID",
          })),
        },
      },
      select: { id: true },
    });

    for (const line of preview.lines) {
      await tx.product.update({
        where: { id: line.productId },
        data: { salesCount: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cart: { userId: params.userId } } });

    return created.id;
  });

  await Promise.all([
    withSchemaFallback(() => prisma.cartBundle.deleteMany({ where: { cart: { userId: params.userId } } }), { count: 0 }),
    withSchemaFallback(
      () => prisma.cart.updateMany({ where: { userId: params.userId }, data: { couponCode: null } }),
      { count: 0 },
    ),
  ]);

  const sellerIds = [...new Set(preview.lines.map((line) => line.sellerId))];
  const sellers = await prisma.sellerProfile.findMany({
    where: { id: { in: sellerIds } },
    select: { userId: true },
  });
  for (const seller of sellers) {
    await notify({
      userId: seller.userId,
      type: "ORDER",
      title: preview.coupon ? "100% coupon order claimed" : "Free resource claimed",
      body: preview.coupon
        ? `A buyer claimed a download using promo code ${preview.coupon.code}.`
        : "A buyer unlocked your free download.",
      href: "/dashboard/orders",
    });
  }

  return { orderId, couponCode: preview.coupon?.code ?? null };
}

/**
 * Claims a single €0 product directly from its product page without Stripe.
 */
export async function claimFreeSingleProduct(params: {
  userId: string;
  productId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<{ orderId: string; productSlug: string; productTitle: string }> {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
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
          userId: true,
          status: true,
          commissionBps: true,
          user: { select: { status: true } },
        },
      },
    },
  });

  if (!product || product.status !== "PUBLISHED") {
    throw new CheckoutError("This product is not available for download.");
  }
  if (product.seller.status !== "APPROVED" || product.seller.user.status !== "ACTIVE") {
    throw new CheckoutError("This product is temporarily unavailable while the store is under review.");
  }
  if (product.seller.userId === params.userId) {
    throw new CheckoutError("You cannot claim your own product.");
  }

  const effectivePrice = product.salePriceMinor ?? product.priceMinor;
  if (effectivePrice !== 0) {
    throw new CheckoutError("This product is not free — add it to your cart to purchase.");
  }

  const alreadyOwned = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: { buyerId: params.userId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    },
    select: { id: true },
  });
  if (alreadyOwned) {
    throw new CheckoutError("You already own this product — open Orders & downloads.");
  }

  const rules = await activeRules();
  const rate = resolveCommissionRate({
    productId: product.id,
    categoryId: product.categoryId,
    sellerId: product.sellerId,
    sellerCommissionBps: product.seller.commissionBps,
    rules,
  });

  const orderId = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const created = await tx.order.create({
      data: {
        orderNumber: orderNumber(),
        buyerId: params.userId,
        status: "PAID",
        paidAt: now,
        currency: product.currency,
        subtotalMinor: 0,
        discountMinor: 0,
        totalMinor: 0,
        platformFeeMinor: 0,
        sellerNetMinor: 0,
        isTestMode: false,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        items: {
          create: {
            productId: product.id,
            sellerId: product.sellerId,
            titleSnapshot: product.title,
            priceMinor: 0,
            quantity: 1,
            commissionBps: rate.rateBps,
            platformFeeMinor: 0,
            sellerNetMinor: 0,
            currency: product.currency,
            status: "PAID",
          },
        },
      },
      select: { id: true },
    });

    await tx.product.update({
      where: { id: product.id },
      data: { salesCount: { increment: 1 } },
    });

    await tx.cartItem.deleteMany({
      where: { productId: product.id, cart: { userId: params.userId } },
    });

    return created.id;
  });

  await notify({
    userId: product.seller.userId,
    type: "ORDER",
    title: "Free resource claimed",
    body: `A buyer claimed “${product.title}”.`,
    href: "/dashboard/orders",
  });

  return { orderId, productSlug: product.slug, productTitle: product.title };
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
  const baseCheckoutSelect = {
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
  };

  const order = await withSchemaFallback(
    () =>
      prisma.order.findUnique({
        where: { id: params.orderId },
        select: {
          ...baseCheckoutSelect,
          couponCodeSnapshot: true,
        },
      }),
    async () => {
      const legacy = await prisma.order.findUnique({
        where: { id: params.orderId },
        select: baseCheckoutSelect,
      });
      return legacy ? { ...legacy, couponCodeSnapshot: null as string | null } : null;
    },
  );

  if (!order) throw new CheckoutError("Order not found.");
  if (order.totalMinor < STRIPE_MIN_CHARGE_MINOR) {
    throw new CheckoutError("Order total is below Stripe's minimum card charge.");
  }

  const session = await params.stripe.checkout.sessions.create({
    mode: "payment",
    // The platform is the merchant of record for the charge; sellers are paid
    // out through Transfers once their earnings clear the hold period.
    customer_email: order.buyer.email,
    client_reference_id: order.id,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      ...(order.couponCodeSnapshot ? { couponCode: order.couponCodeSnapshot } : {}),
    },
    payment_intent_data: {
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    },
    ...(env.stripe.automaticTax
      ? {
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
        }
      : {}),
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
  const baseOrderSelect = {
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
  };

  const order = await withSchemaFallback(
    () =>
      prisma.order.findUnique({
        where: { id: params.orderId },
        select: {
          ...baseOrderSelect,
          couponId: true,
        },
      }),
    async () => {
      const legacy = await prisma.order.findUnique({
        where: { id: params.orderId },
        select: baseOrderSelect,
      });
      return legacy ? { ...legacy, couponId: null as string | null } : null;
    },
  );

  if (!order) throw new CheckoutError("Order not found.");
  if (order.status === "PAID" || order.status === "PARTIALLY_REFUNDED") {
    return { alreadyPaid: true };
  }

  const availableAt = new Date(
    Date.now() + env.marketplace.earningsHoldDays * 24 * 60 * 60 * 1000,
  );
  const holdDays = env.marketplace.earningsHoldDays;

  const transitioned = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        stripePaymentIntentId: params.paymentIntentId,
        receiptUrl: params.receiptUrl,
        isTestMode: params.isTestMode,
      },
    });
    if (claimed.count === 0) return false;

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

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { redemptionCount: { increment: 1 } },
      });
    }

    for (const item of order.items) {
      if (item.priceMinor > 0 || item.platformFeeMinor > 0 || item.sellerNetMinor > 0) {
        // One earning row per paid order line; the unique orderItemId constraint
        // makes a duplicate webhook delivery a no-op.
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
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { salesCount: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cart: { userId: order.buyerId } } });
    return true;
  });

  if (!transitioned) {
    return { alreadyPaid: true };
  }

  await Promise.all([
    withSchemaFallback(() => prisma.cartBundle.deleteMany({ where: { cart: { userId: order.buyerId } } }), {
      count: 0,
    }),
    withSchemaFallback(
      () => prisma.cart.updateMany({ where: { userId: order.buyerId }, data: { couponCode: null } }),
      { count: 0 },
    ),
  ]);

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
