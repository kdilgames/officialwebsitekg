import { prisma } from "@/lib/db";
import { sweepMaturedEarnings } from "@/lib/payments/payouts";

/**
 * Seller dashboard queries.
 *
 * Every number rendered by the dashboard is produced here from real rows in the
 * database. Nothing is estimated, sampled or hard-coded.
 */

export type CurrencyTotals = Record<string, number>;

export type SellerOverview = {
  products: { total: number; published: number; inReview: number; drafts: number; rejected: number };
  sales: { total: number; last30Days: number };
  views: { total: number };
  followers: number;
  rating: { sum: number; count: number };
  revenue: CurrencyTotals;
  pending: CurrencyTotals;
  available: CurrencyTotals;
  paidOut: CurrencyTotals;
  reversed: CurrencyTotals;
  currencies: string[];
  trend: Array<{ day: string; minor: number }>;
};

function add(target: CurrencyTotals, currency: string, minor: number): void {
  target[currency] = (target[currency] ?? 0) + minor;
}

export async function getSellerOverview(sellerId: string): Promise<SellerOverview> {
  // Promotes earnings whose hold period has elapsed before any balance is shown.
  await sweepMaturedEarnings(sellerId);

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 29);

  const [statusCounts, aggregates, followers, earnings, salesLast30Days, trendRows] =
    await Promise.all([
      prisma.product.groupBy({
        by: ["status"],
        where: { sellerId },
        _count: { _all: true },
      }),
      prisma.product.aggregate({
        where: { sellerId },
        _sum: { viewCount: true, ratingSum: true, ratingCount: true },
      }),
      prisma.follow.count({ where: { sellerId } }),
      prisma.sellerEarning.groupBy({
        by: ["status", "currency"],
        where: { sellerId },
        _sum: { netMinor: true },
      }),
      prisma.orderItem.count({
        where: { sellerId, status: "PAID", createdAt: { gte: since } },
      }),
      prisma.sellerEarning.findMany({
        where: { sellerId, status: { not: "REVERSED" }, createdAt: { gte: since } },
        select: { createdAt: true, netMinor: true },
      }),
    ]);

  const counted = (status: string) =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0;

  const totalProducts = statusCounts.reduce((total, row) => total + row._count._all, 0);

  const revenue: CurrencyTotals = {};
  const pending: CurrencyTotals = {};
  const available: CurrencyTotals = {};
  const paidOut: CurrencyTotals = {};
  const reversed: CurrencyTotals = {};

  for (const row of earnings) {
    const minor = row._sum.netMinor ?? 0;
    switch (row.status) {
      case "PENDING":
        add(pending, row.currency, minor);
        add(revenue, row.currency, minor);
        break;
      case "AVAILABLE":
        add(available, row.currency, minor);
        add(revenue, row.currency, minor);
        break;
      case "PAID":
        add(paidOut, row.currency, minor);
        add(revenue, row.currency, minor);
        break;
      case "REVERSED":
        add(reversed, row.currency, minor);
        break;
    }
  }

  // 30-day series, bucketed by UTC day.
  const buckets = new Map<string, number>();
  for (let index = 0; index < 30; index += 1) {
    const day = new Date(since.getTime() + index * 24 * 60 * 60 * 1000);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }
  for (const row of trendRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + row.netMinor);
  }

  const currencies = [
    ...new Set([...Object.keys(revenue), ...Object.keys(reversed)]),
  ].sort();

  return {
    products: {
      total: totalProducts,
      published: counted("PUBLISHED"),
      inReview: counted("PENDING_REVIEW"),
      drafts: counted("DRAFT"),
      rejected: counted("REJECTED") + counted("SUSPENDED"),
    },
    sales: {
      total: await prisma.orderItem.count({ where: { sellerId, status: "PAID" } }),
      last30Days: salesLast30Days,
    },
    views: { total: aggregates._sum.viewCount ?? 0 },
    followers,
    rating: {
      sum: aggregates._sum.ratingSum ?? 0,
      count: aggregates._sum.ratingCount ?? 0,
    },
    revenue,
    pending,
    available,
    paidOut,
    reversed,
    currencies,
    trend: [...buckets.entries()].map(([day, minor]) => ({ day, minor })),
  };
}

export async function listSellerProducts(sellerId: string) {
  return prisma.product.findMany({
    where: { sellerId },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      rejectionReason: true,
      priceMinor: true,
      salePriceMinor: true,
      currency: true,
      salesCount: true,
      viewCount: true,
      ratingSum: true,
      ratingCount: true,
      updatedAt: true,
      category: { select: { name: true } },
      _count: { select: { files: { where: { isActive: true } }, images: true, versions: true } },
    },
  });
}

export async function getSellerProduct(sellerId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, sellerId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      rejectionReason: true,
      shortDescription: true,
      description: true,
      priceMinor: true,
      salePriceMinor: true,
      currency: true,
      categoryId: true,
      tags: true,
      version: true,
      licenseType: true,
      licenseText: true,
      compatibility: true,
      requirements: true,
      thumbnailUrl: true,
      salesCount: true,
      viewCount: true,
      ratingSum: true,
      ratingCount: true,
      submittedAt: true,
      publishedAt: true,
      updatedAt: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, alt: true, sortOrder: true },
      },
      files: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          sizeBytes: true,
          mimeType: true,
          scanStatus: true,
          scanNote: true,
          isActive: true,
          createdAt: true,
          versionId: true,
          _count: { select: { downloads: true } },
        },
      },
      versions: {
        orderBy: { releasedAt: "desc" },
        select: { id: true, version: true, changelog: true, isLatest: true, releasedAt: true },
      },
    },
  });
}

export type SellerProductDetail = NonNullable<Awaited<ReturnType<typeof getSellerProduct>>>;

export async function listSellerOrderItems(sellerId: string, take = 60) {
  return prisma.orderItem.findMany({
    where: {
      sellerId,
      order: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] } },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      titleSnapshot: true,
      priceMinor: true,
      platformFeeMinor: true,
      sellerNetMinor: true,
      refundedMinor: true,
      currency: true,
      status: true,
      createdAt: true,
      product: { select: { slug: true, title: true } },
      order: {
        select: {
          orderNumber: true,
          status: true,
          paidAt: true,
          isTestMode: true,
          buyer: { select: { displayName: true, username: true } },
        },
      },
    },
  });
}

export async function listSellerReviews(sellerId: string, take = 40) {
  return prisma.review.findMany({
    where: { product: { sellerId } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      status: true,
      isVerifiedPurchase: true,
      sellerReply: true,
      sellerRepliedAt: true,
      createdAt: true,
      product: { select: { slug: true, title: true } },
      user: { select: { displayName: true, username: true } },
    },
  });
}

export async function listSellerPayouts(sellerId: string, take = 30) {
  return prisma.payout.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      amountMinor: true,
      currency: true,
      status: true,
      stripeTransferId: true,
      failureReason: true,
      processedAt: true,
      createdAt: true,
      _count: { select: { earnings: true } },
    },
  });
}

export async function listSellerEarnings(sellerId: string, take = 40) {
  return prisma.sellerEarning.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      grossMinor: true,
      platformFeeMinor: true,
      netMinor: true,
      currency: true,
      status: true,
      availableAt: true,
      transferredAt: true,
      reversedAt: true,
      reversalReason: true,
      createdAt: true,
      payout: { select: { id: true, status: true } },
      orderItem: {
        select: {
          titleSnapshot: true,
          commissionBps: true,
          order: { select: { orderNumber: true } },
        },
      },
    },
  });
}

export async function listActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}
