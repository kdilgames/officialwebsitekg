"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit, getRequestContext, notify } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
} from "@/lib/action-state";
import { reportSchema, reviewSchema, sellerReplySchema } from "@/lib/validation";
import { safeNext } from "@/lib/utils/next";

async function cartIdFor(userId: string): Promise<string> {
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });
  return cart.id;
}

export async function addToCartAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  const productId = String(formData.get("productId") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/cart"), "/cart");

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!productId) return errorState("Missing product.");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true, sellerId: true, seller: { select: { userId: true } } },
  });

  if (!product || product.status !== "PUBLISHED") {
    return errorState("This product is not available for purchase.");
  }

  // A seller cannot buy their own listing: it would create a self-dealing order.
  if (product.seller.userId === user.id) {
    return errorState("You cannot purchase your own product.");
  }

  const alreadyOwned = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    },
    select: { id: true },
  });
  if (alreadyOwned) {
    return errorState("You already own this product — find it under Orders & downloads.");
  }

  const cartId = await cartIdFor(user.id);
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId: product.id } },
    update: {},
    create: { cartId, productId: product.id },
  });

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  redirect(next);
}

export async function removeFromCartAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const itemId = String(formData.get("itemId") ?? "");
  if (!user || !itemId) return;

  await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId: user.id } } });
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

export async function toggleWishlistAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  const productId = String(formData.get("productId") ?? "");
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/account/wishlist")}`);
  }
  if (!productId) return errorState("Missing product.");

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
  } else {
    await prisma.wishlistItem.create({ data: { userId: user.id, productId } });
  }

  revalidatePath("/account/wishlist");
  return successState(existing ? "Removed from wishlist." : "Saved to wishlist.");
}

export async function toggleFollowAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  const sellerId = String(formData.get("sellerId") ?? "");
  if (!user) redirect("/login");
  if (!sellerId) return errorState("Missing seller.");

  const existing = await prisma.follow.findUnique({
    where: { followerId_sellerId: { followerId: user.id, sellerId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({ data: { followerId: user.id, sellerId } });
  }

  revalidatePath("/", "layout");
  return successState(existing ? "Unfollowed." : "Following.");
}

export async function submitReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = reviewSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const limit = await rateLimit(`review:${user.id}`, 10, 60 * 60);
  if (!limit.ok) return errorState("Too many reviews submitted. Try again later.");

  // A review is only possible against a paid order line the reviewer owns.
  const orderItem = await prisma.orderItem.findFirst({
    where: {
      id: parsed.data.orderItemId,
      productId: parsed.data.productId,
      status: { in: ["PAID", "REFUNDED"] },
      order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    },
    select: { id: true, productId: true, product: { select: { sellerId: true, slug: true } } },
  });

  if (!orderItem) {
    return errorState("Only verified purchases can be reviewed.");
  }

  const existing = await prisma.review.findFirst({
    where: { productId: parsed.data.productId, userId: user.id },
    select: { id: true },
  });
  if (existing) return errorState("You have already reviewed this product.");

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        productId: parsed.data.productId,
        userId: user.id,
        orderItemId: orderItem.id,
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        body: parsed.data.body,
        isVerifiedPurchase: true,
      },
    });

    const aggregate = await tx.review.aggregate({
      where: { productId: parsed.data.productId, status: "PUBLISHED" },
      _sum: { rating: true },
      _count: { rating: true },
    });

    await tx.product.update({
      where: { id: parsed.data.productId },
      data: {
        ratingSum: aggregate._sum.rating ?? 0,
        ratingCount: aggregate._count.rating ?? 0,
      },
    });
  });

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: orderItem.product.sellerId },
    select: { userId: true },
  });
  if (seller) {
    await notify({
      userId: seller.userId,
      type: "REVIEW",
      title: "New review on your product",
      body: `A buyer rated your product ${parsed.data.rating}/5.`,
      href: `/product/${orderItem.product.slug}`,
    });
  }

  revalidatePath(`/product/${orderItem.product.slug}`);
  return successState("Thanks — your review is published.");
}

export async function sellerReplyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user?.sellerProfile) return errorState("Only sellers can reply to reviews.");

  const parsed = sellerReplySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  // Scoped by sellerId so one seller can never write on another seller's review.
  const review = await prisma.review.findFirst({
    where: { id: parsed.data.reviewId, product: { sellerId: user.sellerProfile.id } },
    select: { id: true, product: { select: { slug: true } } },
  });
  if (!review) return errorState("Review not found.");

  await prisma.review.update({
    where: { id: review.id },
    data: { sellerReply: parsed.data.reply, sellerRepliedAt: new Date() },
  });

  revalidatePath(`/product/${review.product.slug}`);
  revalidatePath("/dashboard/reviews");
  return successState("Reply published.");
}

export async function reportContentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();

  const parsed = reportSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct the highlighted fields.", toFieldErrors(parsed.error.issues));
  }

  const context = await getRequestContext();
  const limit = await rateLimit(`report:${user?.id ?? context.ipAddress ?? "anon"}`, 10, 60 * 60);
  if (!limit.ok) return errorState("Too many reports filed. Try again later.");

  await prisma.report.create({
    data: {
      reporterId: user?.id ?? null,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
    },
  });

  if (user) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "report.created",
      entityType: parsed.data.targetType,
      entityId: parsed.data.targetId,
      after: { reason: parsed.data.reason },
    });
  }

  return successState("Report received. Platform staff will review it.");
}
