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
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { clampBps, percentToBps } from "@/lib/commission";
import { prisma } from "@/lib/db";
import { ConnectError } from "@/lib/payments/connect";
import { cancelPayout, executePayout } from "@/lib/payments/payouts";
import { decideRefundRequest, executeRefund, failRefund, RefundError } from "@/lib/payments/refunds";
import { categorySchema, commissionRuleSchema } from "@/lib/validation";

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
    select: { id: true, status: true, storeName: true, userId: true },
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
    prisma.user.update({ where: { id: seller.userId }, data: { role: "SELLER" } }),
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
      status: true,
      salesCount: true,
      seller: { select: { userId: true, storeName: true, status: true } },
      _count: { select: { files: { where: { isActive: true } }, images: true } },
    },
  });
  if (!product) return;

  // A listing with nothing to deliver must never go live, even if an
  // administrator is the one pressing the button.
  if (product._count.files === 0) return;
  if (product.seller.status !== "APPROVED") return;

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: "PUBLISHED",
      publishedAt: product.salesCount > 0 ? undefined : new Date(),
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

// ---------------------------------------------------------------- users

export async function updateUserRoleAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const userId = text(formData, "userId");
  const raw = text(formData, "role");
  const role = (["USER", "SELLER", "ADMIN"] as const).find((value) => value === raw);
  if (!role) return;

  // An administrator must never be able to lock the platform out by demoting
  // the last remaining administrator.
  if (user.id === userId && role !== "ADMIN") return;
  if (role !== "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (target?.role === "ADMIN" && admins <= 1) return;
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, username: true },
  });
  if (!target) return;

  await prisma.user.update({ where: { id: target.id }, data: { role } });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "user.role_changed",
    entityType: "User",
    entityId: target.id,
    before: { role: target.role },
    after: { role },
  });

  revalidateAdmin("/admin/users");
}

export async function suspendUserAction(formData: FormData): Promise<void> {
  const access = await gate();
  if (!access.ok) return;
  const { user } = access;

  const userId = text(formData, "userId");
  const reason = text(formData, "reason") || "Account suspended by platform staff.";
  if (userId === user.id) return;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true, sellerProfile: { select: { id: true } } },
  });
  if (!target || target.status === "SUSPENDED") return;
  if (target.role === "ADMIN") return;

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

  revalidateAdmin("/admin/users", "/admin/sellers");
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

  revalidateAdmin("/admin/users");
}

// ---------------------------------------------------------------- settings

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

  revalidateAdmin("/admin/settings");
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

  revalidateAdmin("/admin/settings");
}
