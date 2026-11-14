"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit, getRequestContext, notify } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { previewCart } from "@/lib/payments/orders";
import { rateLimit } from "@/lib/rate-limit";
import {
  errorState,
  formToObject,
  successState,
  toFieldErrors,
  type ActionState,
} from "@/lib/action-state";
import {
  answerQuestionSchema,
  applyCouponSchema,
  questionSchema,
  reportSchema,
  reviewSchema,
  sellerReplySchema,
} from "@/lib/validation";
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

export async function addBundleToCartAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  const bundleId = String(formData.get("bundleId") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/cart"), "/cart");

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!bundleId) return errorState("Missing bundle.");

  const bundle = await prisma.productBundle.findUnique({
    where: { id: bundleId },
    select: {
      id: true,
      isActive: true,
      seller: { select: { userId: true, status: true, user: { select: { status: true } } } },
      items: { select: { productId: true, product: { select: { status: true } } } },
    },
  });

  if (
    !bundle ||
    !bundle.isActive ||
    bundle.seller.status !== "APPROVED" ||
    bundle.seller.user.status !== "ACTIVE" ||
    bundle.items.length < 2 ||
    bundle.items.some((item) => item.product.status !== "PUBLISHED")
  ) {
    return errorState("This bundle is no longer available.");
  }

  if (bundle.seller.userId === user.id) {
    return errorState("You cannot purchase your own bundle.");
  }

  const productIds = bundle.items.map((item) => item.productId);
  const owned = await prisma.orderItem.findMany({
    where: {
      productId: { in: productIds },
      order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    },
    select: { productId: true },
  });
  const ownedSet = new Set(owned.map((row) => row.productId));
  if (productIds.every((id) => ownedSet.has(id))) {
    return errorState("You already own every product included in this bundle.");
  }

  const cartId = await cartIdFor(user.id);
  await prisma.cartBundle.upsert({
    where: { cartId_bundleId: { cartId, bundleId: bundle.id } },
    update: {},
    create: { cartId, bundleId: bundle.id },
  });

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  redirect(next);
}

export async function removeBundleFromCartAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const bundleEntryId = String(formData.get("bundleEntryId") ?? "");
  if (!user || !bundleEntryId) return;

  await prisma.cartBundle.deleteMany({
    where: { id: bundleEntryId, cart: { userId: user.id } },
  });
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

export async function applyCouponAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fcart");

  const parsed = applyCouponSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Enter a valid promo code.", toFieldErrors(parsed.error.issues));
  }

  const currentCart = await prisma.cart.findUnique({
    where: { userId: user.id },
    select: { id: true, couponCode: true },
  });
  const previousCode = currentCart?.couponCode ?? null;
  const cartId = currentCart?.id ?? (await cartIdFor(user.id));

  await prisma.cart.update({
    where: { id: cartId },
    data: { couponCode: parsed.data.code },
  });

  const preview = await previewCart(user.id);
  if (preview.lines.length === 0) {
    await prisma.cart.update({ where: { id: cartId }, data: { couponCode: previousCode } });
    return errorState("Add at least one item to your cart before applying a promo code.");
  }

  if (preview.couponError || !preview.coupon) {
    await prisma.cart.update({ where: { id: cartId }, data: { couponCode: previousCode } });
    return errorState(preview.couponError ?? "Promo code could not be applied.");
  }

  revalidatePath("/cart");
  return successState(`Promo code ${preview.coupon.code} applied.`);
}

export async function removeCouponAction(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  await prisma.cart.updateMany({
    where: { userId: user.id },
    data: { couponCode: null },
  });
  revalidatePath("/cart");
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

  revalidatePath("/account/following");
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

export async function askProductQuestionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = questionSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct your question.", toFieldErrors(parsed.error.issues));
  }

  const limit = await rateLimit(`question:${user.id}`, 10, 60 * 60);
  if (!limit.ok) {
    return errorState("You have posted several questions recently. Please wait before posting another.");
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, slug: true, title: true, status: true, seller: { select: { userId: true } } },
  });
  if (!product || product.status !== "PUBLISHED") {
    return errorState("This product is not available for questions.");
  }
  if (product.seller.userId === user.id) {
    return errorState("Sellers answer questions directly on existing buyer threads.");
  }

  await prisma.productQuestion.create({
    data: {
      productId: product.id,
      userId: user.id,
      question: parsed.data.question,
    },
  });

  await notify({
    userId: product.seller.userId,
    type: "QUESTION",
    title: `New question on ${product.title}`,
    body: parsed.data.question.slice(0, 140),
    href: `/product/${product.slug}#qa`,
  });

  revalidatePath(`/product/${product.slug}`);
  revalidatePath(`/dashboard/products/${product.id}`);
  return successState("Question posted. The creator will be notified.");
}

export async function answerProductQuestionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = answerQuestionSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return errorState("Please correct your answer.", toFieldErrors(parsed.error.issues));
  }

  const question = await prisma.productQuestion.findUnique({
    where: { id: parsed.data.questionId },
    select: {
      id: true,
      userId: true,
      productId: true,
      product: { select: { slug: true, title: true, sellerId: true } },
    },
  });
  if (!question) return errorState("Question not found.");

  const isOwningSeller = user.sellerProfile?.id === question.product.sellerId;
  const isAdmin = user.role === "ADMIN";
  if (!isOwningSeller && !isAdmin) {
    return errorState("Only the product's creator can post an official answer.");
  }

  await prisma.productQuestion.update({
    where: { id: question.id },
    data: { answer: parsed.data.answer, answeredAt: new Date() },
  });

  if (question.userId !== user.id) {
    await notify({
      userId: question.userId,
      type: "QUESTION",
      title: `Answer on ${question.product.title}`,
      body: parsed.data.answer.slice(0, 140),
      href: `/product/${question.product.slug}#qa`,
    });
  }

  revalidatePath(`/product/${question.product.slug}`);
  revalidatePath(`/dashboard/products/${question.productId}`);
  return successState("Answer published.");
}

export async function hideProductQuestionAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const questionId = String(formData.get("questionId") ?? "");
  if (!user || !questionId) return;

  const question = await prisma.productQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      productId: true,
      isHidden: true,
      product: { select: { slug: true, sellerId: true } },
    },
  });
  if (!question) return;

  const isOwningSeller = user.sellerProfile?.id === question.product.sellerId;
  const isAdmin = user.role === "ADMIN";
  if (!isOwningSeller && !isAdmin) return;

  await prisma.productQuestion.update({
    where: { id: question.id },
    data: { isHidden: !question.isHidden },
  });

  revalidatePath(`/product/${question.product.slug}`);
  revalidatePath(`/dashboard/products/${question.productId}`);
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const notificationId = String(formData.get("notificationId") ?? "");
  if (!user || !notificationId) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
  revalidatePath("/account/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
  revalidatePath("/account/notifications");
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
