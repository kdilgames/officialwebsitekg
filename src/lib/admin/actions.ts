"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
} from "@/lib/action-state";
import { notify, recordAudit, recordModeration } from "@/lib/audit";
import { getAllowlistedEmailsFromSettings } from "@/lib/auth/admin-access";
import {
  ADMIN_ALLOWLIST_SETTING_KEY,
  canModifyAdminAccount,
  canSuspendAccount,
  isOwnerEmail,
  normalizeEmail,
  resolveOwnerEmail,
} from "@/lib/auth/admin-access-rules";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { clampBps, percentToBps } from "@/lib/commission";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { minorUnitFactor } from "@/lib/money";
import {
  notifyDiscordApprovedProduct,
  sendDiscordTestWebhook,
} from "@/lib/discord-webhook";
import { maskDiscordWebhookUrl, parseDiscordWebhookUrl } from "@/lib/discord-webhook-rules";
import { ConnectError } from "@/lib/payments/connect";
import { cancelPayout, executePayout } from "@/lib/payments/payouts";
import { decideRefundRequest, executeRefund, failRefund, RefundError } from "@/lib/payments/refunds";
import {
  DISCORD_RELEASE_WEBHOOK_KEY,
  getDiscordReleaseWebhookUrl,
  SITE_ANNOUNCEMENT_KEY,
} from "@/lib/settings";
import {
  announcementSettingSchema,
  categorySchema,
  commissionRuleSchema,
  couponSchema,
  discordSettingSchema,
  discordWebhookSettingSchema,
  grantAdminByEmailSchema,
} from "@/lib/validation";

/**
 * Administrative actions.
 *
 * Every one of these re-derives the caller's role from the session and the
 * database. Hiding a button in the interface is never the control — these
 * functions are the control, and they are the only way these state changes can
 * be reached.
 */

type AdminGate = { ok: true; user: SessionUser } | { ok: false; error: ActionState };

async function gate(): Promise<AdminGate> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: errorState("Your session expired. Sign in again.") };
  if (user.role !== "ADMIN") {
    return { ok: false, error: errorState("Administrator access is required for this action.") };
  }
  return { ok: true, user };
}

function emptyToNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateAdmin(...paths: string[]) {
  revalidatePath("/admin");
  for (const path of paths) revalidatePath(path);
}

function revalidateStorefront(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/browse");
  if (slug) revalidatePath(`/product/${slug}`);
}

// ---------------------------------------------------------------- sellers

export async function approveSellerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const sellerId = text(formData, "sellerId");
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      status: true,
      storeName: true,
      userId: true,
      user: { select: { role: true } },
    },
  });
  if (!seller) return errorState("Seller application not found.");

  const rawCommission = text(formData, "commissionPercent");
  let commissionBps: number | undefined;
  if (rawCommission.length > 0) {
    const parsed = Number.parseFloat(rawCommission.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 90) {
      return errorState("The commission override must be between 0 and 90 percent.", {
        commissionPercent: "Enter a value between 0 and 90.",
      });
    }
    commissionBps = clampBps(percentToBps(parsed));
  }

  await prisma.$transaction([
    prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        status: "APPROVED",
        reviewNote: emptyToNull(formData.get("reviewNote")),
        reviewedAt: new Date(),
        reviewedById: user.id,
        ...(commissionBps === undefined ? {} : { commissionBps }),
      },
    }),
    ...(seller.user.role === "USER"
      ? [prisma.user.update({ where: { id: seller.userId }, data: { role: "SELLER" } })]
      : []),
  ]);

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.approved",
    entityType: "SellerProfile",
    entityId: seller.id,
    before: { status: seller.status },
    after: { status: "APPROVED", commissionBps: commissionBps ?? null },
  });
  await recordModeration({
    moderatorId: user.id,
    targetType: "SellerProfile",
    targetId: seller.id,
    action: "approve",
    reason: emptyToNull(formData.get("reviewNote")),
  });

  await notify({
    userId: seller.userId,
    type: "MODERATION",
    title: "Your seller application was approved",
    body: "You can now publish products from your dashboard.",
    href: "/dashboard",
  });

  revalidateAdmin("/admin/sellers");
  return successState(`${seller.storeName} can now publish products.`);
}

export async function rejectSellerAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const sellerId = text(formData, "sellerId");
  const reason = text(formData, "reason");
  if (!reason) return;

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { id: true, status: true, userId: true, storeName: true },
  });
  if (!seller) return;

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: {
      status: "REJECTED",
      reviewNote: reason,
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.rejected",
    entityType: "SellerProfile",
    entityId: seller.id,
    before: { status: seller.status },
    after: { status: "REJECTED", reason },
  });
  await recordModeration({
    moderatorId: user.id,
    targetType: "SellerProfile",
    targetId: seller.id,
    action: "reject",
    reason,
  });

  await notify({
    userId: seller.userId,
    type: "MODERATION",
    title: "Your seller application was not approved",
    body: reason,
    href: "/account/seller",
  });

  revalidateAdmin("/admin/sellers");
}

export async function suspendSellerAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const sellerId = text(formData, "sellerId");
  const reason = text(formData, "reason") || "Suspended by platform staff.";

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { id: true, status: true, userId: true, storeName: true },
  });
  if (!seller) return;
  if (seller.status === "SUSPENDED") return;

  // Suspending a store must also take its listings off the storefront, so the
  // catalogue cannot keep selling for an account under review.
  await prisma.$transaction([
    prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { status: "SUSPENDED", reviewNote: reason, reviewedAt: new Date(), reviewedById: user.id },
    }),
    prisma.product.updateMany({
      where: { sellerId: seller.id, status: "PUBLISHED" },
      data: { status: "SUSPENDED" },
    }),
  ]);

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.suspended",
    entityType: "SellerProfile",
    entityId: seller.id,
    before: { status: seller.status },
    after: { status: "SUSPENDED", reason },
  });

  await notify({
    userId: seller.userId,
    type: "MODERATION",
    title: "Your seller account was suspended",
    body: reason,
    href: "/account/seller",
  });

  revalidateAdmin("/admin/sellers", "/admin/products");
  revalidateStorefront();
}

export async function reinstateSellerAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const sellerId = text(formData, "sellerId");
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { id: true, status: true, userId: true, storeName: true },
  });
  if (!seller || seller.status !== "SUSPENDED") return;

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: user.id },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "seller.reinstated",
    entityType: "SellerProfile",
    entityId: seller.id,
    before: { status: seller.status },
    after: { status: "APPROVED" },
  });

  await notify({
    userId: seller.userId,
    type: "MODERATION",
    title: "Your store was reinstated",
    body: "Listings were not republished automatically — resubmit them for review.",
    href: "/dashboard/products",
  });

  revalidateAdmin("/admin/sellers");
}

// ---------------------------------------------------------------- products

export async function approveProductAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const productId = text(formData, "productId");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      priceMinor: true,
      salePriceMinor: true,
      currency: true,
      version: true,
      thumbnailUrl: true,
      status: true,
      publishedAt: true,
      salesCount: true,
      category: { select: { name: true } },
      seller: { select: { userId: true, storeName: true, status: true } },
      _count: { select: { files: { where: { isActive: true } }, images: true } },
    },
  });
  if (!product) return;

  // A listing with nothing to deliver must never go live, even if an
  // administrator is the one pressing the button.
  if (product._count.files === 0) return;
  if (product.seller.status !== "APPROVED") return;

  const isFirstPublish = product.publishedAt === null;

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: "PUBLISHED",
      publishedAt: product.publishedAt ?? new Date(),
      reviewedAt: new Date(),
      reviewedById: user.id,
      rejectionReason: null,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.approved",
    entityType: "Product",
    entityId: product.id,
    before: { status: product.status },
    after: { status: "PUBLISHED" },
  });
  await recordModeration({
    moderatorId: user.id,
    targetType: "Product",
    targetId: product.id,
    action: "approve",
  });

  await notify({
    userId: product.seller.userId,
    type: "MODERATION",
    title: "Your product is live",
    body: `“${product.title}” was approved and is now on the storefront.`,
    href: `/product/${product.slug}`,
  });

  if (isFirstPublish) {
    await notifyDiscordApprovedProduct({
      slug: product.slug,
      title: product.title,
      shortDescription: product.shortDescription,
      priceMinor: product.priceMinor,
      salePriceMinor: product.salePriceMinor,
      currency: product.currency,
      version: product.version,
      thumbnailUrl: product.thumbnailUrl,
      categoryName: product.category.name,
      storeName: product.seller.storeName,
    });
  }

  revalidateAdmin("/admin/products");
  revalidateStorefront(product.slug);
}

export async function rejectProductAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const productId = text(formData, "productId");
  const reason = text(formData, "reason");
  if (reason.length < 5) return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      seller: { select: { userId: true } },
    },
  });
  if (!product) return;

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.rejected",
    entityType: "Product",
    entityId: product.id,
    before: { status: product.status },
    after: { status: "REJECTED", reason },
  });
  await recordModeration({
    moderatorId: user.id,
    targetType: "Product",
    targetId: product.id,
    action: "reject",
    reason,
  });

  await notify({
    userId: product.seller.userId,
    type: "MODERATION",
    title: "Your product needs changes",
    body: `“${product.title}”: ${reason}`,
    href: `/dashboard/products/${product.id}`,
  });

  revalidateAdmin("/admin/products");
  revalidateStorefront(product.slug);
}

export async function suspendProductAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const productId = text(formData, "productId");
  const reason = text(formData, "reason") || "Removed by platform staff.";

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      seller: { select: { userId: true } },
    },
  });
  if (!product || product.status === "SUSPENDED") return;

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: "SUSPENDED",
      rejectionReason: reason,
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "product.suspended",
    entityType: "Product",
    entityId: product.id,
    before: { status: product.status },
    after: { status: "SUSPENDED", reason },
  });
  await recordModeration({
    moderatorId: user.id,
    targetType: "Product",
    targetId: product.id,
    action: "suspend",
    reason,
  });

  await notify({
    userId: product.seller.userId,
    type: "MODERATION",
    title: "Your product was removed",
    body: `“${product.title}”: ${reason}`,
    href: `/dashboard/products/${product.id}`,
  });

  revalidateAdmin("/admin/products");
  revalidateStorefront(product.slug);
}

export async function toggleFeaturedProductAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const productId = text(formData, "productId");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, isFeatured: true, status: true },
  });
  if (!product) return;

  const next = !product.isFeatured;
  await prisma.product.update({ where: { id: product.id }, data: { isFeatured: next } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: next ? "product.featured" : "product.unfeatured",
    entityType: "Product",
    entityId: product.id,
    before: { isFeatured: product.isFeatured },
    after: { isFeatured: next },
  });

  revalidateAdmin("/admin/products");
  revalidateStorefront(product.slug);
}

// ---------------------------------------------------------------- categories

export async function createCategoryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const parsed = categorySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }
  const data = parsed.data;

  const clash = await prisma.category.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (clash) return errorState("That slug is already in use.", { slug: "Already in use." });

  if (data.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId },
      select: { id: true },
    });
    if (!parent) return errorState("The parent category no longer exists.", { parentId: "Unknown." });
  }

  const created = await prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: emptyToNull(data.description),
      icon: emptyToNull(data.icon),
      parentId: data.parentId ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "category.created",
    entityType: "Category",
    entityId: created.id,
    after: { name: data.name, slug: data.slug },
  });

  revalidateAdmin("/admin/categories");
  revalidateStorefront();
  return successState(`Category “${data.name}” created.`);
}

export async function updateCategoryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const categoryId = text(formData, "categoryId");
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, slug: true, name: true, parentId: true },
  });
  if (!existing) return errorState("Category not found.");

  const parsed = categorySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }
  const data = parsed.data;

  if (data.slug !== existing.slug) {
    const clash = await prisma.category.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (clash) return errorState("That slug is already in use.", { slug: "Already in use." });
  }

  if (data.parentId === existing.id) {
    return errorState("A category cannot be its own parent.", { parentId: "Invalid parent." });
  }

  await prisma.category.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      slug: data.slug,
      description: emptyToNull(data.description),
      icon: emptyToNull(data.icon),
      parentId: data.parentId ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "category.updated",
    entityType: "Category",
    entityId: existing.id,
    before: { name: existing.name, slug: existing.slug },
    after: { name: data.name, slug: data.slug, isActive: data.isActive },
  });

  revalidateAdmin("/admin/categories");
  revalidateStorefront();
  return successState("Category saved.");
}

export async function toggleCategoryAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const categoryId = text(formData, "categoryId");
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true, slug: true },
  });
  if (!category) return;

  await prisma.category.update({
    where: { id: category.id },
    data: { isActive: !category.isActive },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: category.isActive ? "category.hidden" : "category.shown",
    entityType: "Category",
    entityId: category.id,
    before: { isActive: category.isActive },
    after: { isActive: !category.isActive },
  });

  revalidateAdmin("/admin/categories");
  revalidateStorefront();
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const categoryId = text(formData, "categoryId");
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true, children: true } },
    },
  });
  if (!category) return;

  // Products reference their category with `Restrict`, and orphaned child
  // categories would break navigation, so neither is ever silently detached.
  if (category._count.products > 0 || category._count.children > 0) return;

  await prisma.category.delete({ where: { id: category.id } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "category.deleted",
    entityType: "Category",
    entityId: category.id,
    before: { name: category.name },
  });

  revalidateAdmin("/admin/categories");
}

// ---------------------------------------------------------------- commissions

export async function saveCommissionRuleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const parsed = commissionRuleSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }
  const data = parsed.data;
  const rateBps = clampBps(percentToBps(data.ratePercent));

  const targetId = data.targetId ?? null;
  if (data.scope !== "GLOBAL" && !targetId) {
    return errorState("Choose what this rate applies to.", { targetId: "A target is required." });
  }

  if (data.scope === "CATEGORY" && targetId) {
    const exists = await prisma.category.count({ where: { id: targetId } });
    if (exists === 0) return errorState("That category no longer exists.", { targetId: "Unknown." });
  }
  if (data.scope === "SELLER" && targetId) {
    const exists = await prisma.sellerProfile.count({ where: { id: targetId } });
    if (exists === 0) return errorState("That seller no longer exists.", { targetId: "Unknown." });
  }
  if (data.scope === "PRODUCT" && targetId) {
    const exists = await prisma.product.count({ where: { id: targetId } });
    if (exists === 0) return errorState("That product no longer exists.", { targetId: "Unknown." });
  }

  const existing = await prisma.commissionRule.findFirst({
    where: { scope: data.scope, targetId },
    select: { id: true, rateBps: true, isActive: true },
  });

  const payload = {
    rateBps,
    note: emptyToNull(data.note),
    isActive: data.isActive,
    createdById: user.id,
  };

  if (existing) {
    await prisma.commissionRule.update({ where: { id: existing.id }, data: payload });
  } else {
    await prisma.commissionRule.create({
      data: { scope: data.scope, targetId, ...payload },
    });
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: existing ? "commission.updated" : "commission.created",
    entityType: "CommissionRule",
    entityId: existing?.id ?? null,
    before: existing ? { rateBps: existing.rateBps, isActive: existing.isActive } : undefined,
    after: { scope: data.scope, targetId, rateBps, isActive: data.isActive },
  });

  revalidateAdmin("/admin/commissions", "/admin/settings");
  return successState(
    existing
      ? `Rate updated to ${(rateBps / 100).toFixed(2)}%. It applies to new orders only.`
      : `Rate of ${(rateBps / 100).toFixed(2)}% created. It applies to new orders only.`,
  );
}

export async function deleteCommissionRuleAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const ruleId = text(formData, "ruleId");
  const rule = await prisma.commissionRule.findUnique({
    where: { id: ruleId },
    select: { id: true, scope: true, targetId: true, rateBps: true },
  });
  if (!rule) return;

  await prisma.commissionRule.delete({ where: { id: rule.id } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "commission.deleted",
    entityType: "CommissionRule",
    entityId: rule.id,
    before: { scope: rule.scope, targetId: rule.targetId, rateBps: rule.rateBps },
  });

  revalidateAdmin("/admin/commissions");
}

// ---------------------------------------------------------------- refunds

export async function decideRefundAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const refundId = text(formData, "refundId");
  const decision = text(formData, "decision");
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return errorState("Choose approve or reject.");
  }

  try {
    await decideRefundRequest({
      refundId,
      adminId: user.id,
      decision,
      adminNote: emptyToNull(formData.get("adminNote")),
    });
  } catch (error) {
    if (error instanceof RefundError) return errorState(error.message);
    throw error;
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: decision === "APPROVED" ? "refund.approved" : "refund.rejected",
    entityType: "Refund",
    entityId: refundId,
    after: { decision },
  });

  revalidateAdmin("/admin/refunds", "/admin/orders");
  return successState(
    decision === "APPROVED"
      ? "Approved. Send it to Stripe to return the money."
      : "Request declined. No money was moved.",
  );
}

export async function executeRefundAction(
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const refundId = text(_formData, "refundId");

  try {
    const result = await executeRefund({ refundId, adminId: user.id });

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "refund.sent_to_stripe",
      entityType: "Refund",
      entityId: refundId,
      after: { stripeRefundId: result.stripeRefundId },
    });

    revalidateAdmin("/admin/refunds", "/admin/orders");
    return successState(
      `Stripe accepted refund ${result.stripeRefundId}. The order is closed once the refund settles.`,
    );
  } catch (error) {
    if (error instanceof RefundError || error instanceof ConnectError) {
      return errorState(error.message);
    }
    throw error;
  }
}

export async function failRefundAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const refundId = text(formData, "refundId");
  const reason = text(formData, "reason");
  if (reason.length < 5) return errorState("Explain why the refund failed.");

  try {
    await failRefund({ refundId, adminId: user.id, reason });
  } catch (error) {
    if (error instanceof RefundError) return errorState(error.message);
    throw error;
  }

  revalidateAdmin("/admin/refunds");
  return successState("Refund marked as failed. Nothing was returned to the buyer.");
}

// ---------------------------------------------------------------- payouts

export async function executePayoutAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const payoutId = text(formData, "payoutId");

  try {
    const result = await executePayout({ payoutId, adminId: user.id });

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "payout.executed",
      entityType: "Payout",
      entityId: payoutId,
      after: { transferId: result.transferId },
    });

    revalidateAdmin("/admin/payouts", "/dashboard/earnings");
    return successState(`Transfer ${result.transferId} sent to the seller's Stripe account.`);
  } catch (error) {
    if (error instanceof ConnectError) return errorState(error.message);
    throw error;
  }
}

export async function cancelPayoutAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const payoutId = text(formData, "payoutId");
  const reason = text(formData, "reason");
  if (reason.length < 5) return errorState("Give a reason so the seller understands.");

  try {
    await cancelPayout({ payoutId, adminId: user.id, reason });

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "payout.canceled",
      entityType: "Payout",
      entityId: payoutId,
      after: { reason },
    });
  } catch (error) {
    if (error instanceof ConnectError) return errorState(error.message);
    throw error;
  }

  revalidateAdmin("/admin/payouts", "/dashboard/earnings");
  return successState("Payout canceled. The balance is available to the seller again.");
}

// ---------------------------------------------------------------- reports

const REPORT_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] as const;

export async function resolveReportAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const reportId = text(formData, "reportId");
  const rawStatus = text(formData, "status");
  const status = REPORT_STATUSES.find((value) => value === rawStatus);
  if (!status) return errorState("Unknown status.");

  const note = emptyToNull(formData.get("resolutionNote"));
  if ((status === "RESOLVED" || status === "DISMISSED") && !note) {
    return errorState("Record what you found before closing the report.", {
      resolutionNote: "A note is required to close a report.",
    });
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, targetType: true, targetId: true, reporterId: true },
  });
  if (!report) return errorState("Report not found.");

  await prisma.report.update({
    where: { id: report.id },
    data: {
      status,
      resolutionNote: note,
      handledById: user.id,
      handledAt: status === "OPEN" || status === "UNDER_REVIEW" ? null : new Date(),
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: `report.${status.toLowerCase()}`,
    entityType: "Report",
    entityId: report.id,
    before: { status: report.status },
    after: { status, note },
  });

  if (report.reporterId && (status === "RESOLVED" || status === "DISMISSED")) {
    await notify({
      userId: report.reporterId,
      type: "MODERATION",
      title: status === "RESOLVED" ? "Your report was actioned" : "Your report was reviewed",
      body: note ?? undefined,
    });
  }

  revalidateAdmin("/admin/reports");
  return successState("Report updated.");
}

// ---------------------------------------------------------------- tickets

export async function replyTicketAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const ticketId = text(formData, "ticketId");
  const body = text(formData, "body");
  if (body.length < 1) return errorState("Write a message.");
  if (body.length > 4000) return errorState("Keep the reply under 4000 characters.");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, userId: true, ticketNumber: true, subject: true },
  });
  if (!ticket) return errorState("Ticket not found.");

  const nextStatus = ticket.status === "OPEN" ? "PENDING" : ticket.status;

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, body, isStaff: true },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: nextStatus, assignedToId: user.id },
    }),
  ]);

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "ticket.replied",
    entityType: "SupportTicket",
    entityId: ticket.id,
  });

  await notify({
    userId: ticket.userId,
    type: "TICKET",
    title: `Support replied to ${ticket.ticketNumber}`,
    body: body.slice(0, 160),
    href: `/support/${ticket.ticketNumber}`,
  });

  revalidateAdmin("/admin/tickets");
  return successState("Reply sent.");
}

export async function setTicketStatusAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const ticketId = text(formData, "ticketId");
  const raw = text(formData, "status");
  const status = (["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const).find((v) => v === raw);
  if (!status) return;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });
  if (!ticket) return;

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status,
      closedAt: status === "CLOSED" || status === "RESOLVED" ? new Date() : null,
      assignedToId: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: `ticket.${status.toLowerCase()}`,
    entityType: "SupportTicket",
    entityId: ticket.id,
    before: { status: ticket.status },
    after: { status },
  });

  revalidateAdmin("/admin/tickets");
}

// ---------------------------------------------------------------- reviews

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const reviewId = text(formData, "reviewId");
  const raw = text(formData, "status");
  const status = (["PUBLISHED", "HIDDEN", "REMOVED"] as const).find((value) => value === raw);
  if (!status) return;
  const reason = emptyToNull(formData.get("reason"));

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      status: true,
      rating: true,
      productId: true,
      userId: true,
      product: { select: { slug: true, sellerId: true } },
    },
  });
  if (!review) return;

  await prisma.review.update({ where: { id: review.id }, data: { status } });

  // A removed review must leave the public rating totals, otherwise the
  // scoreboard would keep counting a review nobody can read.
  const wasCounted = review.status === "PUBLISHED";
  const willCount = status === "PUBLISHED";
  if (wasCounted !== willCount) {
    await prisma.product.update({
      where: { id: review.productId },
      data: {
        ratingSum: { increment: willCount ? review.rating : -review.rating },
        ratingCount: { increment: willCount ? 1 : -1 },
      },
    });
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: `review.${status.toLowerCase()}`,
    entityType: "Review",
    entityId: review.id,
    before: { status: review.status },
    after: { status, reason },
  });
  await recordModeration({
    moderatorId: user.id,
    targetType: "Review",
    targetId: review.id,
    action: status.toLowerCase(),
    reason,
  });

  revalidateAdmin("/admin/reviews", "/admin/reports");
  revalidateStorefront(review.product.slug);
}

// ---------------------------------------------------------------- users & email admin access

export async function updateUserRoleAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const userId = text(formData, "userId");
  const raw = text(formData, "role");
  const role = (["USER", "SELLER", "ADMIN"] as const).find((value) => value === raw);
  if (!role) return;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, username: true, email: true },
  });
  if (!target) return;

  const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
  const check = canModifyAdminAccount({
    actorId: user.id,
    targetId: target.id,
    targetEmail: target.email,
    targetRole: target.role,
    nextRole: role,
    activeAdminCount: activeAdmins,
    ownerEmail: env.auth.ownerEmail,
  });
  if (!check.allowed) return;

  await prisma.user.update({ where: { id: target.id }, data: { role } });

  // If a previously allowlisted email is manually demoted via Users table, keep
  // the DB allowlist synchronized so their next request does not re-promote them.
  if (target.role === "ADMIN" && role !== "ADMIN") {
    const targetEmail = normalizeEmail(target.email);
    const currentAllowlist = await getAllowlistedEmailsFromSettings();
    if (currentAllowlist.includes(targetEmail)) {
      const updated = currentAllowlist.filter((entry) => entry !== targetEmail);
      await prisma.siteSetting.upsert({
        where: { key: ADMIN_ALLOWLIST_SETTING_KEY },
        update: { value: updated, updatedById: user.id },
        create: {
          key: ADMIN_ALLOWLIST_SETTING_KEY,
          value: updated,
          description: "Emails granted ADMIN privileges upon verification.",
          updatedById: user.id,
        },
      });
    }
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "user.role_changed",
    entityType: "User",
    entityId: target.id,
    before: { role: target.role },
    after: { role },
  });

  revalidateAdmin("/admin/users", "/admin/access");
}

export async function suspendUserAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const userId = text(formData, "userId");
  const reason = text(formData, "reason") || "Account suspended by platform staff.";

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      sellerProfile: { select: { id: true } },
    },
  });
  if (!target || target.status === "SUSPENDED") return;

  const check = canSuspendAccount({
    actorId: user.id,
    targetId: target.id,
    targetEmail: target.email,
    targetRole: target.role,
    ownerEmail: env.auth.ownerEmail,
  });
  if (!check.allowed) return;

  // The session layer already refuses a suspended account, and the storefront
  // stops selling its listings here.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { status: "SUSPENDED", suspendedReason: reason },
    }),
    ...(target.sellerProfile
      ? [
          prisma.sellerProfile.update({
            where: { id: target.sellerProfile.id },
            data: { status: "SUSPENDED", reviewNote: reason },
          }),
          prisma.product.updateMany({
            where: { sellerId: target.sellerProfile.id, status: "PUBLISHED" },
            data: { status: "SUSPENDED" },
          }),
        ]
      : []),
  ]);

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "user.suspended",
    entityType: "User",
    entityId: target.id,
    before: { status: target.status },
    after: { status: "SUSPENDED", reason },
  });

  revalidateAdmin("/admin/users", "/admin/sellers", "/admin/access");
  revalidateStorefront();
}

export async function reinstateUserAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const userId = text(formData, "userId");
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });
  if (!target || target.status !== "SUSPENDED") return;

  await prisma.user.update({
    where: { id: target.id },
    data: { status: "ACTIVE", suspendedReason: null },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "user.reinstated",
    entityType: "User",
    entityId: target.id,
    before: { status: target.status },
    after: { status: "ACTIVE" },
  });

  revalidateAdmin("/admin/users", "/admin/access");
}

export async function grantAdminByEmailAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const parsed = grantAdminByEmailSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Enter a valid email address.", toFieldErrors(parsed.error.issues));
  }

  const email = normalizeEmail(parsed.data.email);
  const ownerEmail = resolveOwnerEmail(env.auth.ownerEmail);

  if (isOwnerEmail(email, ownerEmail)) {
    return successState(`${ownerEmail} is already the protected primary owner email.`);
  }

  const targetUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
    },
  });

  if (targetUser && targetUser.status !== "ACTIVE") {
    return errorState(
      `Cannot grant administrator access because @${targetUser.username} is ${targetUser.status.toLowerCase()}.`,
    );
  }

  const currentAllowlist = await getAllowlistedEmailsFromSettings();
  const nextAllowlist = currentAllowlist.includes(email)
    ? currentAllowlist
    : [...currentAllowlist, email];

  if (!env.auth.adminEmails.includes(email) && nextAllowlist.length !== currentAllowlist.length) {
    await prisma.siteSetting.upsert({
      where: { key: ADMIN_ALLOWLIST_SETTING_KEY },
      update: { value: nextAllowlist, updatedById: user.id },
      create: {
        key: ADMIN_ALLOWLIST_SETTING_KEY,
        value: nextAllowlist,
        description: "Emails granted ADMIN privileges upon verification.",
        updatedById: user.id,
      },
    });
  }

  if (targetUser && targetUser.emailVerified) {
    const previousRole = targetUser.role;
    if (previousRole !== "ADMIN") {
      await prisma.user.update({
        where: { id: targetUser.id },
        data: { role: "ADMIN" },
      });
    }

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "admin.access_granted",
      entityType: "User",
      entityId: targetUser.id,
      before: { role: previousRole },
      after: { email, role: "ADMIN" },
    });

    if (previousRole !== "ADMIN") {
      await notify({
        userId: targetUser.id,
        type: "SYSTEM",
        title: "You were granted administrator access",
        body: `Granted by @${user.username}. Open the administration panel to manage the marketplace.`,
        href: "/admin",
      });
    }

    revalidateAdmin("/admin/access", "/admin/users");
    return successState(
      previousRole === "ADMIN"
        ? `${email} (@${targetUser.username}) already has administrator access.`
        : `${email} (@${targetUser.username}) has been promoted to administrator.`,
    );
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "admin.allowlist_added",
    entityType: "SiteSetting",
    entityId: ADMIN_ALLOWLIST_SETTING_KEY,
    after: { email },
  });

  revalidateAdmin("/admin/access", "/admin/users");
  return successState(
    targetUser
      ? `${email} added to allowlist. Once they confirm their email address, ADMIN access unlocks automatically.`
      : `${email} added to the admin allowlist. When they sign in via the email link or verify their email, ADMIN access activates automatically.`,
  );
}

export async function revokeAdminAccessAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const email = normalizeEmail(text(formData, "email"));
  if (!email) return errorState("Email address is missing.");

  const ownerEmail = resolveOwnerEmail(env.auth.ownerEmail);
  if (isOwnerEmail(email, ownerEmail)) {
    return errorState(`The primary owner email (${ownerEmail}) is protected and cannot be revoked.`);
  }

  if (normalizeEmail(user.email) === email) {
    return errorState("You cannot revoke administrator access from your own active session.");
  }

  const targetUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      sellerProfile: { select: { status: true } },
    },
  });

  if (targetUser && targetUser.role === "ADMIN") {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    const nextRole = targetUser.sellerProfile?.status === "APPROVED" ? "SELLER" : "USER";
    const check = canModifyAdminAccount({
      actorId: user.id,
      targetId: targetUser.id,
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
      nextRole,
      activeAdminCount: activeAdmins,
      ownerEmail,
    });
    if (!check.allowed) {
      return errorState(check.reason ?? "Cannot modify this administrator account.");
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: nextRole },
    });

    await notify({
      userId: targetUser.id,
      type: "SYSTEM",
      title: "Administrator access updated",
      body: `Your account role was changed to ${nextRole.toLowerCase()}.`,
      href: "/account",
    }).catch(() => undefined);
  }

  const currentAllowlist = await getAllowlistedEmailsFromSettings();
  if (currentAllowlist.includes(email)) {
    const updated = currentAllowlist.filter((entry) => entry !== email);
    await prisma.siteSetting.upsert({
      where: { key: ADMIN_ALLOWLIST_SETTING_KEY },
      update: { value: updated, updatedById: user.id },
      create: {
        key: ADMIN_ALLOWLIST_SETTING_KEY,
        value: updated,
        description: "Emails granted ADMIN privileges upon verification.",
        updatedById: user.id,
      },
    });
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "admin.access_revoked",
    entityType: targetUser ? "User" : "SiteSetting",
    entityId: targetUser?.id ?? ADMIN_ALLOWLIST_SETTING_KEY,
    after: { email },
  });

  revalidateAdmin("/admin/access", "/admin/users");

  if (env.auth.adminEmails.includes(email)) {
    return errorState(
      `${email} is configured in the server ADMIN_EMAILS environment variable and will regain admin access on next sign-in until removed there.`,
    );
  }

  return successState(`Administrator access revoked for ${email}.`);
}

// ---------------------------------------------------------------- settings

export async function saveAnnouncementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const parsed = announcementSettingSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please check the announcement fields.", toFieldErrors(parsed.error.issues));
  }

  const existing = await prisma.siteSetting.findUnique({
    where: { key: SITE_ANNOUNCEMENT_KEY },
    select: { value: true },
  });

  if (!parsed.data.text) {
    if (existing) {
      await prisma.siteSetting.delete({ where: { key: SITE_ANNOUNCEMENT_KEY } });
      await recordAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "setting.deleted",
        entityType: "SiteSetting",
        entityId: SITE_ANNOUNCEMENT_KEY,
        before: { value: existing.value },
      });
    }
    revalidateAdmin("/admin/settings");
    revalidatePath("/", "layout");
    return successState("Announcement banner cleared.");
  }

  const value: Prisma.InputJsonValue = {
    enabled: parsed.data.enabled,
    text: parsed.data.text,
    tone: parsed.data.tone,
    ...(parsed.data.href ? { href: parsed.data.href } : {}),
    ...(parsed.data.linkLabel ? { linkLabel: parsed.data.linkLabel } : {}),
  };

  await prisma.siteSetting.upsert({
    where: { key: SITE_ANNOUNCEMENT_KEY },
    update: {
      value,
      description: "Top storefront announcement strip managed from Administration.",
      updatedById: user.id,
    },
    create: {
      key: SITE_ANNOUNCEMENT_KEY,
      value,
      description: "Top storefront announcement strip managed from Administration.",
      updatedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: existing ? "setting.updated" : "setting.created",
    entityType: "SiteSetting",
    entityId: SITE_ANNOUNCEMENT_KEY,
    before: existing ? { value: existing.value } : undefined,
    after: { value },
  });

  revalidateAdmin("/admin/settings");
  revalidatePath("/", "layout");
  return successState(
    parsed.data.enabled
      ? "Storefront announcement banner updated and live."
      : "Announcement saved as paused (hidden on storefront).",
  );
}

export async function saveDiscordSettingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const parsed = discordSettingSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Enter a valid Discord invite URL.", toFieldErrors(parsed.error.issues));
  }

  const key = "community_discord_url";
  const existing = await prisma.siteSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  if (!parsed.data.url) {
    if (existing) {
      await prisma.siteSetting.delete({ where: { key } });
      await recordAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "setting.deleted",
        entityType: "SiteSetting",
        entityId: key,
        before: { value: existing.value },
      });
    }
    revalidateAdmin("/admin/settings");
    revalidatePath("/", "layout");
    revalidatePath("/account/seller");
    return successState("Community Discord invite removed.");
  }

  await prisma.siteSetting.upsert({
    where: { key },
    update: {
      value: parsed.data.url,
      description: "Community Discord invite URL surfaced in storefront footer and onboarding.",
      updatedById: user.id,
    },
    create: {
      key,
      value: parsed.data.url,
      description: "Community Discord invite URL surfaced in storefront footer and onboarding.",
      updatedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: existing ? "setting.updated" : "setting.created",
    entityType: "SiteSetting",
    entityId: key,
    before: existing ? { value: existing.value } : undefined,
    after: { value: parsed.data.url },
  });

  revalidateAdmin("/admin/settings");
  revalidatePath("/", "layout");
  revalidatePath("/account/seller");
  return successState("Community Discord invite saved.");
}

export async function saveDiscordWebhookSettingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const intent = text(formData, "intent") || "save";
  const key = DISCORD_RELEASE_WEBHOOK_KEY;

  if (intent === "clear") {
    const existing = await prisma.siteSetting.findUnique({
      where: { key },
      select: { key: true },
    });
    if (existing) {
      await prisma.siteSetting.delete({ where: { key } });
      await recordAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "setting.deleted",
        entityType: "SiteSetting",
        entityId: key,
      });
    }
    revalidateAdmin("/admin/settings");
    return successState("Discord release notifications disabled.");
  }

  const rawUrl = text(formData, "url");

  if (intent === "test") {
    const targetUrl = rawUrl
      ? parseDiscordWebhookUrl(rawUrl)
      : await getDiscordReleaseWebhookUrl();
    if (!targetUrl) {
      return errorState(
        rawUrl
          ? "Enter a valid Discord webhook URL (https://discord.com/api/webhooks/...)."
          : "Paste a Discord webhook URL first or save one before testing.",
        rawUrl ? { url: "Invalid Discord webhook URL." } : undefined,
      );
    }

    const result = await sendDiscordTestWebhook(targetUrl);
    if (!result.ok) {
      return errorState(result.error);
    }
    return successState("Test notification sent to Discord!");
  }

  const parsed = discordWebhookSettingSchema.safeParse({ url: rawUrl });
  if (!parsed.success) {
    return errorState(
      "Enter a valid Discord webhook URL.",
      toFieldErrors(parsed.error.issues),
    );
  }

  const canonicalUrl = parseDiscordWebhookUrl(parsed.data.url);
  if (!canonicalUrl) {
    return errorState("Enter a valid Discord webhook URL.", {
      url: "Invalid Discord webhook URL.",
    });
  }

  const existing = await prisma.siteSetting.findUnique({
    where: { key },
    select: { key: true },
  });

  await prisma.siteSetting.upsert({
    where: { key },
    update: {
      value: canonicalUrl,
      description: "Discord webhook triggered when a new listing is approved.",
      updatedById: user.id,
    },
    create: {
      key,
      value: canonicalUrl,
      description: "Discord webhook triggered when a new listing is approved.",
      updatedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: existing ? "setting.updated" : "setting.created",
    entityType: "SiteSetting",
    entityId: key,
    after: { webhook: maskDiscordWebhookUrl(canonicalUrl) },
  });

  revalidateAdmin("/admin/settings");
  return successState("Discord release webhook saved.");
}

export async function saveSiteSettingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const key = text(formData, "key");
  const rawValue = text(formData, "value");
  const description = emptyToNull(formData.get("description"));

  if (!/^[a-z0-9._-]{2,64}$/.test(key)) {
    return errorState("Use lowercase letters, numbers, dots, dashes or underscores.", {
      key: "Invalid key.",
    });
  }

  // Values are stored as JSON so a setting can hold an object, but a plain
  // string is accepted and stored as-is rather than being rejected.
  let value: Prisma.InputJsonValue;
  try {
    value = JSON.parse(rawValue) as Prisma.InputJsonValue;
  } catch {
    value = rawValue;
  }

  const existing = await prisma.siteSetting.findUnique({
    where: { key },
    select: { key: true, value: true },
  });

  await prisma.siteSetting.upsert({
    where: { key },
    update: { value, description, updatedById: user.id },
    create: { key, value, description, updatedById: user.id },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: existing ? "setting.updated" : "setting.created",
    entityType: "SiteSetting",
    entityId: key,
    before: existing ? { value: existing.value } : undefined,
    after: { value },
  });

  revalidateAdmin("/admin/settings", "/admin/access");
  revalidatePath("/", "layout");
  revalidatePath("/account/seller");
  return successState(`Setting “${key}” saved.`);
}

export async function deleteSiteSettingAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const key = text(formData, "key");
  const existing = await prisma.siteSetting.findUnique({
    where: { key },
    select: { key: true, value: true },
  });
  if (!existing) return;

  await prisma.siteSetting.delete({ where: { key } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "setting.deleted",
    entityType: "SiteSetting",
    entityId: key,
    before: { value: existing.value },
  });

  revalidateAdmin("/admin/settings", "/admin/access");
  revalidatePath("/", "layout");
  revalidatePath("/account/seller");
}

// ---------------------------------------------------------------- coupons

export async function createAdminCouponAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate();
  if (!access.ok) return access.error;
  const { user } = access;

  const parsed = couponSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }
  const data = parsed.data;

  const existing = await prisma.coupon.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) {
    return errorState("That promo code is already in use.", { code: "Already exists." });
  }

  const factor = minorUnitFactor(data.currency);
  const created = await prisma.coupon.create({
    data: {
      code: data.code,
      sellerId: null,
      discountType: data.discountType,
      percentOff: data.discountType === "PERCENT" ? Math.round(data.discountValue) : null,
      amountOffMinor:
        data.discountType === "FIXED" ? Math.round(data.discountValue * factor) : null,
      currency: data.currency,
      minSubtotalMinor:
        data.minSubtotal !== undefined ? Math.round(data.minSubtotal * factor) : null,
      maxRedemptions: data.maxRedemptions ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "coupon.created",
    entityType: "Coupon",
    entityId: created.id,
    after: { code: data.code, discountType: data.discountType, scope: "PLATFORM" },
  });

  revalidateAdmin("/admin/coupons");
  revalidatePath("/cart");
  return successState(`Platform promo code ${data.code} created.`);
}

export async function toggleAdminCouponAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const couponId = text(formData, "couponId");
  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { id: true, code: true, isActive: true },
  });
  if (!coupon) return;

  await prisma.coupon.update({
    where: { id: coupon.id },
    data: { isActive: !coupon.isActive },
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: coupon.isActive ? "coupon.paused" : "coupon.activated",
    entityType: "Coupon",
    entityId: coupon.id,
    after: { code: coupon.code, isActive: !coupon.isActive },
  });

  revalidateAdmin("/admin/coupons");
  revalidatePath("/cart");
}

export async function deleteAdminCouponAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const couponId = text(formData, "couponId");
  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { id: true, code: true },
  });
  if (!coupon) return;

  await prisma.coupon.delete({ where: { id: coupon.id } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "coupon.deleted",
    entityType: "Coupon",
    entityId: coupon.id,
    before: { code: coupon.code },
  });

  revalidateAdmin("/admin/coupons");
  revalidatePath("/cart");
}
