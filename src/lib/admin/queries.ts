import { prisma } from "@/lib/db";
import { sweepMaturedEarnings } from "@/lib/payments/payouts";

/**
 * Admin read layer.
 *
 * Every figure is produced from stored rows. Nothing is estimated: the platform
 * revenue shown to an administrator is the sum of the commission actually
 * written onto paid order lines.
 */

export const ADMIN_PAGE_SIZE = 25;

export type CurrencyTotals = Record<string, number>;

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
};

function pageOf(total: number, page: number): { page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  return { page: Math.min(Math.max(1, page), totalPages), totalPages };
}

function add(target: CurrencyTotals, currency: string, minor: number): void {
  target[currency] = (target[currency] ?? 0) + minor;
}

export type AdminOverview = {
  users: { total: number; active: number; suspended: number; admins: number };
  sellers: {
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
    payoutsEnabled: number;
  };
  products: {
    total: number;
    draft: number;
    inReview: number;
    published: number;
    rejected: number;
    suspended: number;
  };
  catalog: { categories: number; reviews: number };
  orders: { paid: number; pending: number; refunded: number; disputed: number; last30Days: number };
  gross: CurrencyTotals;
  platformFees: CurrencyTotals;
  sellerNet: CurrencyTotals;
  refunded: CurrencyTotals;
  payouts: { pendingCount: number; pending: CurrencyTotals; paid: CurrencyTotals };
  queues: {
    sellerApplications: number;
    productReviews: number;
    reports: number;
    tickets: number;
    refunds: number;
    disputes: number;
    payouts: number;
  };
};

export async function getAdminOverview(): Promise<AdminOverview> {
  // Promotes matured earnings before any balance is summarised.
  await sweepMaturedEarnings();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    userStatus,
    adminCount,
    sellerStatus,
    payoutsEnabled,
    productStatus,
    categoryCount,
    reviewCount,
    orderStatus,
    paidLast30Days,
    itemTotals,
    refundTotals,
    payoutPending,
    payoutPaid,
    applications,
    productQueue,
    reports,
    tickets,
    refunds,
    disputes,
    payoutQueue,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.sellerProfile.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.sellerProfile.count({ where: { stripePayoutsEnabled: true } }),
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.category.count(),
    prisma.review.count(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({ where: { status: "PAID", paidAt: { gte: thirtyDaysAgo } } }),
    prisma.orderItem.groupBy({
      by: ["currency"],
      where: { status: "PAID" },
      _sum: { priceMinor: true, platformFeeMinor: true, sellerNetMinor: true },
    }),
    prisma.refund.groupBy({
      by: ["currency"],
      where: { status: "PROCESSED" },
      _sum: { amountMinor: true },
    }),
    prisma.payout.groupBy({
      by: ["currency"],
      where: { status: "PENDING" },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    prisma.payout.groupBy({
      by: ["currency"],
      where: { status: "PAID" },
      _sum: { amountMinor: true },
    }),
    prisma.sellerProfile.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
    prisma.refund.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    prisma.dispute.count({ where: { status: { in: ["NEEDS_RESPONSE", "UNDER_REVIEW"] } } }),
    prisma.payout.count({ where: { status: "PENDING" } }),
  ]);

  const userCount = (status: string) =>
    userStatus.find((row) => row.status === status)?._count._all ?? 0;
  const sellerCount = (status: string) =>
    sellerStatus.find((row) => row.status === status)?._count._all ?? 0;
  const productCount = (status: string) =>
    productStatus.find((row) => row.status === status)?._count._all ?? 0;
  const orderCount = (status: string) =>
    orderStatus.find((row) => row.status === status)?._count._all ?? 0;

  const gross: CurrencyTotals = {};
  const platformFees: CurrencyTotals = {};
  const sellerNet: CurrencyTotals = {};
  for (const row of itemTotals) {
    add(gross, row.currency, row._sum.priceMinor ?? 0);
    add(platformFees, row.currency, row._sum.platformFeeMinor ?? 0);
    add(sellerNet, row.currency, row._sum.sellerNetMinor ?? 0);
  }

  const refunded: CurrencyTotals = {};
  for (const row of refundTotals) add(refunded, row.currency, row._sum.amountMinor ?? 0);

  const pendingPayout: CurrencyTotals = {};
  let pendingCount = 0;
  for (const row of payoutPending) {
    add(pendingPayout, row.currency, row._sum.amountMinor ?? 0);
    pendingCount += row._count._all;
  }

  const paidPayout: CurrencyTotals = {};
  for (const row of payoutPaid) add(paidPayout, row.currency, row._sum.amountMinor ?? 0);

  return {
    users: {
      total: userStatus.reduce((total, row) => total + row._count._all, 0),
      active: userCount("ACTIVE"),
      suspended: userCount("SUSPENDED"),
      admins: adminCount,
    },
    sellers: {
      pending: sellerCount("PENDING"),
      approved: sellerCount("APPROVED"),
      rejected: sellerCount("REJECTED"),
      suspended: sellerCount("SUSPENDED"),
      payoutsEnabled,
    },
    products: {
      total: productStatus.reduce((total, row) => total + row._count._all, 0),
      draft: productCount("DRAFT"),
      inReview: productCount("PENDING_REVIEW"),
      published: productCount("PUBLISHED"),
      rejected: productCount("REJECTED"),
      suspended: productCount("SUSPENDED"),
    },
    catalog: { categories: categoryCount, reviews: reviewCount },
    orders: {
      paid: orderCount("PAID") + orderCount("PARTIALLY_REFUNDED"),
      pending: orderCount("PENDING"),
      refunded: orderCount("REFUNDED"),
      disputed: orderCount("DISPUTED"),
      last30Days: paidLast30Days,
    },
    gross,
    platformFees,
    sellerNet,
    refunded,
    payouts: { pendingCount, pending: pendingPayout, paid: paidPayout },
    queues: {
      sellerApplications: applications,
      productReviews: productQueue,
      reports,
      tickets,
      refunds,
      disputes,
      payouts: payoutQueue,
    },
  };
}

export type AdminQueueCounts = AdminOverview["queues"];

/**
 * The queue counts shown in the admin navigation.
 *
 * This is deliberately kept separate from `getAdminOverview()`: the layout
 * renders on every admin page, and the overview promotes matured earnings as a
 * side effect, which should not happen on a plain navigation.
 */
export async function getAdminQueueCounts(): Promise<AdminQueueCounts> {
  const [
    sellerApplications,
    productReviews,
    reports,
    tickets,
    refunds,
    disputes,
    payouts,
  ] = await Promise.all([
    prisma.sellerProfile.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
    prisma.refund.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    prisma.dispute.count({ where: { status: { in: ["NEEDS_RESPONSE", "UNDER_REVIEW"] } } }),
    prisma.payout.count({ where: { status: "PENDING" } }),
  ]);

  return { sellerApplications, productReviews, reports, tickets, refunds, disputes, payouts };
}

// ---------------------------------------------------------------- sellers

export type SellerApplicationRow = Awaited<
  ReturnType<typeof listSellerApplications>
>["items"][number];

export async function listSellerApplications(params: {
  status?: string;
  page?: number;
}): Promise<Paged<{
  id: string;
  storeName: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  country: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  applicationNote: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  commissionBps: number | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  createdAt: Date;
  user: { id: string; username: string; displayName: string; email: string; status: string };
  _count: { products: number };
}>> {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED")
      : undefined;

  const where = status ? { status } : {};
  const total = await prisma.sellerProfile.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.sellerProfile.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      storeName: true,
      slug: true,
      tagline: true,
      about: true,
      country: true,
      websiteUrl: true,
      supportEmail: true,
      applicationNote: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      commissionBps: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      createdAt: true,
      user: {
        select: { id: true, username: true, displayName: true, email: true, status: true },
      },
      _count: { select: { products: true } },
    },
  });

  return { items, total, ...window };
}

/** Options for the commission "seller override" picker. */
export async function listSellerOptions() {
  return prisma.sellerProfile.findMany({
    where: { status: "APPROVED" },
    orderBy: { storeName: "asc" },
    select: { id: true, storeName: true, commissionBps: true },
  });
}

// ---------------------------------------------------------------- products

export async function listProductsForModeration(params: {
  status?: string;
  q?: string;
  page?: number;
}) {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as
          | "DRAFT"
          | "PENDING_REVIEW"
          | "PUBLISHED"
          | "REJECTED"
          | "SUSPENDED"
          | "ARCHIVED")
      : undefined;

  const search = params.q?.trim();
  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
            { seller: { storeName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const total = await prisma.product.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.product.findMany({
    where,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      isFeatured: true,
      priceMinor: true,
      salePriceMinor: true,
      currency: true,
      rejectionReason: true,
      salesCount: true,
      viewCount: true,
      ratingSum: true,
      ratingCount: true,
      submittedAt: true,
      publishedAt: true,
      createdAt: true,
      thumbnailUrl: true,
      category: { select: { name: true, slug: true } },
      seller: { select: { id: true, storeName: true, slug: true } },
      _count: {
        select: {
          files: { where: { isActive: true } },
          images: true,
          versions: true,
        },
      },
    },
  });

  return { items, total, ...window };
}

export type ModerationProductRow = Awaited<
  ReturnType<typeof listProductsForModeration>
>["items"][number];

/** Options for the commission "single product" override picker. */
export async function listProductOptions() {
  return prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { title: "asc" },
    take: 500,
    select: { id: true, title: true },
  });
}

export async function getProductModerationDetail(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      description: true,
      shortDescription: true,
      licenseType: true,
      licenseText: true,
      tags: true,
      rejectionReason: true,
      isFeatured: true,
      thumbnailUrl: true,
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
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
        },
      },
      versions: {
        orderBy: { releasedAt: "desc" },
        select: { id: true, version: true, changelog: true, releasedAt: true, isLatest: true },
      },
      category: { select: { name: true, slug: true } },
      seller: {
        select: { id: true, storeName: true, slug: true, status: true, payoutCurrency: true },
      },
    },
  });
}

// ---------------------------------------------------------------- categories

export async function listAllCategories() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true, children: true } },
    },
  });
}

// ---------------------------------------------------------------- commissions

export async function listCommissionRules() {
  return prisma.commissionRule.findMany({
    orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      scope: true,
      targetId: true,
      rateBps: true,
      note: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ---------------------------------------------------------------- orders

export async function listOrders(params: { status?: string; q?: string; page?: number }) {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as
          | "PENDING"
          | "PAID"
          | "PARTIALLY_REFUNDED"
          | "REFUNDED"
          | "CANCELED"
          | "DISPUTED")
      : undefined;

  const search = params.q?.trim();
  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" as const } },
            { buyer: { username: { contains: search, mode: "insensitive" as const } } },
            { buyer: { email: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const total = await prisma.order.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currency: true,
      subtotalMinor: true,
      totalMinor: true,
      platformFeeMinor: true,
      sellerNetMinor: true,
      isTestMode: true,
      paidAt: true,
      refundedAt: true,
      createdAt: true,
      stripePaymentIntentId: true,
      buyer: { select: { username: true, displayName: true, email: true } },
      payment: { select: { status: true, failureReason: true, providerRef: true } },
      dispute: { select: { id: true, status: true, evidenceDueBy: true, amountMinor: true } },
      _count: { select: { items: true, refunds: true } },
    },
  });

  return { items, total, ...window };
}

export type AdminOrderRow = Awaited<ReturnType<typeof listOrders>>["items"][number];

// ---------------------------------------------------------------- refunds

export async function listRefunds(params: { status?: string; page?: number }) {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as
          | "REQUESTED"
          | "APPROVED"
          | "REJECTED"
          | "PROCESSING"
          | "PROCESSED"
          | "FAILED")
      : undefined;

  const where = status ? { status } : {};
  const total = await prisma.refund.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.refund.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      amountMinor: true,
      currency: true,
      reason: true,
      status: true,
      buyerNote: true,
      adminNote: true,
      stripeRefundId: true,
      processedAt: true,
      createdAt: true,
      requestedBy: { select: { username: true, displayName: true, email: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalMinor: true,
          currency: true,
          stripePaymentIntentId: true,
          paidAt: true,
          buyer: { select: { username: true, displayName: true } },
        },
      },
      orderItem: { select: { id: true, titleSnapshot: true, priceMinor: true } },
    },
  });

  return { items, total, ...window };
}

export type AdminRefundRow = Awaited<ReturnType<typeof listRefunds>>["items"][number];

export async function listDisputes(params: { status?: string; page?: number }) {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as
          | "NEEDS_RESPONSE"
          | "UNDER_REVIEW"
          | "WON"
          | "LOST"
          | "WARNING_CLOSED")
      : undefined;

  const where = status ? { status } : {};
  const total = await prisma.dispute.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.dispute.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      stripeDisputeId: true,
      amountMinor: true,
      currency: true,
      reason: true,
      status: true,
      evidenceDueBy: true,
      resolvedAt: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalMinor: true,
          buyer: { select: { username: true, displayName: true } },
        },
      },
    },
  });

  return { items, total, ...window };
}

// ---------------------------------------------------------------- payouts

export async function listPayouts(params: { status?: string; page?: number }) {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as "PENDING" | "IN_TRANSIT" | "PAID" | "FAILED" | "CANCELED")
      : undefined;

  const where = status ? { status } : {};
  const total = await prisma.payout.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.payout.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      amountMinor: true,
      currency: true,
      status: true,
      method: true,
      stripeTransferId: true,
      failureReason: true,
      processedAt: true,
      createdAt: true,
      seller: {
        select: {
          id: true,
          storeName: true,
          slug: true,
          stripeAccountId: true,
          stripePayoutsEnabled: true,
        },
      },
      initiator: { select: { username: true, displayName: true } },
      _count: { select: { earnings: true } },
    },
  });

  return { items, total, ...window };
}

export type AdminPayoutRow = Awaited<ReturnType<typeof listPayouts>>["items"][number];

// ---------------------------------------------------------------- trust & support

export async function listReports(params: { status?: string; page?: number }) {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED")
      : undefined;

  const where = status ? { status } : {};
  const total = await prisma.report.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.report.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      details: true,
      status: true,
      resolutionNote: true,
      handledAt: true,
      createdAt: true,
      reporter: { select: { username: true, displayName: true, email: true } },
      handledBy: { select: { username: true, displayName: true } },
    },
  });

  return { items, total, ...window };
}

export type AdminReportRow = Awaited<ReturnType<typeof listReports>>["items"][number];

/**
 * Reports store a polymorphic target, so the referenced titles are resolved
 * separately for display. Missing targets are reported as unavailable rather
 * than hidden.
 */
export async function describeReportTargets(
  reports: Array<{ targetType: string; targetId: string }>,
): Promise<Record<string, { label: string; href: string | null }>> {
  const productIds = reports
    .filter((report) => report.targetType === "PRODUCT")
    .map((report) => report.targetId);
  const userIds = reports.filter((report) => report.targetType === "USER").map((r) => r.targetId);
  const reviewIds = reports
    .filter((report) => report.targetType === "REVIEW")
    .map((report) => report.targetId);

  const [products, users, reviews] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true, slug: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, displayName: true },
        })
      : Promise.resolve([]),
    reviewIds.length
      ? prisma.review.findMany({
          where: { id: { in: reviewIds } },
          select: { id: true, title: true, product: { select: { slug: true } } },
        })
      : Promise.resolve([]),
  ]);

  const result: Record<string, { label: string; href: string | null }> = {};
  for (const product of products) {
    result[product.id] = { label: product.title, href: `/product/${product.slug}` };
  }
  for (const user of users) {
    result[user.id] = { label: `${user.displayName} (@${user.username})`, href: null };
  }
  for (const review of reviews) {
    result[review.id] = {
      label: `Review on ${review.title ?? review.product.slug}`,
      href: `/product/${review.product.slug}`,
    };
  }
  return result;
}

export async function listTickets(params: { status?: string; page?: number }) {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as "OPEN" | "PENDING" | "RESOLVED" | "CLOSED")
      : undefined;

  const where = status ? { status } : {};
  const total = await prisma.supportTicket.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.supportTicket.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      closedAt: true,
      user: { select: { username: true, displayName: true, email: true } },
      assignedTo: { select: { username: true, displayName: true } },
      order: { select: { orderNumber: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 30,
        select: {
          id: true,
          body: true,
          isStaff: true,
          createdAt: true,
          authorId: true,
        },
      },
    },
  });

  return { items, total, ...window };
}

export type AdminTicketRow = Awaited<ReturnType<typeof listTickets>>["items"][number];

export async function listReviewsForModeration(params: { status?: string; page?: number }) {
  const status =
    params.status && params.status !== "ALL"
      ? (params.status as "PUBLISHED" | "HIDDEN" | "REMOVED")
      : undefined;

  const where = status ? { status } : {};
  const total = await prisma.review.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.review.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      status: true,
      isVerifiedPurchase: true,
      sellerReply: true,
      createdAt: true,
      product: { select: { id: true, title: true, slug: true, sellerId: true } },
      user: { select: { id: true, username: true, displayName: true } },
    },
  });

  return { items, total, ...window };
}

export type AdminReviewRow = Awaited<
  ReturnType<typeof listReviewsForModeration>
>["items"][number];

// ---------------------------------------------------------------- users

export async function listUsers(params: { q?: string; role?: string; page?: number }) {
  const role =
    params.role && params.role !== "ALL" ? (params.role as "USER" | "SELLER" | "ADMIN") : undefined;

  const search = params.q?.trim();
  const where = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { displayName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.user.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      emailVerified: true,
      role: true,
      status: true,
      suspendedReason: true,
      country: true,
      createdAt: true,
      lastLoginAt: true,
      sellerProfile: { select: { id: true, storeName: true, status: true } },
      _count: { select: { orders: true } },
    },
  });

  return { items, total, ...window };
}

export type AdminUserRow = Awaited<ReturnType<typeof listUsers>>["items"][number];

// ---------------------------------------------------------------- settings & audit

export async function listSiteSettings() {
  return prisma.siteSetting.findMany({
    orderBy: { key: "asc" },
    select: {
      key: true,
      value: true,
      description: true,
      updatedAt: true,
      updatedBy: { select: { username: true, displayName: true } },
    },
  });
}

export async function listAuditLogs(params: { action?: string; page?: number }) {
  const action = params.action?.trim();
  const where = action
    ? { action: { contains: action, mode: "insensitive" as const } }
    : {};

  const total = await prisma.auditLog.count({ where });
  const window = pageOf(total, params.page ?? 1);

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (window.page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      action: true,
      actorRole: true,
      entityType: true,
      entityId: true,
      before: true,
      after: true,
      ipAddress: true,
      createdAt: true,
      actor: { select: { username: true, displayName: true } },
    },
  });

  return { items, total, ...window };
}

export type AuditLogRow = Awaited<ReturnType<typeof listAuditLogs>>["items"][number];
