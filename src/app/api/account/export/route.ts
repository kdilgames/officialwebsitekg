import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GDPR Art. 20 personal data portability export.
 *
 * Returns a downloadable JSON archive of all personal data associated with the
 * authenticated user account. Secrets, password hashes, and internal tokens are
 * never included.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const limit = await rateLimit(`gdpr-export:${user.id}`, 5, 60 * 60);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Export limit reached. You can request up to 5 exports per hour." },
      { status: 429 },
    );
  }

  const [profile, sellerProfile, orders, reviews, wishlist, follows, tickets, notifications, questions] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          bio: true,
          country: true,
          role: true,
          status: true,
          marketingOptIn: true,
          termsAcceptedAt: true,
          privacyAcceptedAt: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.sellerProfile.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          storeName: true,
          slug: true,
          tagline: true,
          about: true,
          websiteUrl: true,
          supportEmail: true,
          country: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.order.findMany({
        where: { buyerId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true,
          status: true,
          currency: true,
          subtotalMinor: true,
          discountMinor: true,
          totalMinor: true,
          paidAt: true,
          createdAt: true,
          items: {
            select: {
              titleSnapshot: true,
              priceMinor: true,
              quantity: true,
              currency: true,
              status: true,
            },
          },
        },
      }),
      prisma.review.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          product: { select: { slug: true, title: true } },
        },
      }),
      prisma.wishlistItem.findMany({
        where: { userId: user.id },
        select: {
          createdAt: true,
          product: { select: { slug: true, title: true } },
        },
      }),
      prisma.follow.findMany({
        where: { followerId: user.id },
        select: {
          createdAt: true,
          seller: { select: { slug: true, storeName: true } },
        },
      }),
      prisma.supportTicket.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          messages: {
            orderBy: { createdAt: "asc" },
            select: { body: true, isStaff: true, createdAt: true },
          },
        },
      }),
      withSchemaFallback(
        () =>
          prisma.notification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 200,
            select: { type: true, title: true, body: true, readAt: true, createdAt: true },
          }),
        [],
      ),
      withSchemaFallback(
        () =>
          prisma.productQuestion.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            select: {
              question: true,
              answer: true,
              createdAt: true,
              product: { select: { slug: true, title: true } },
            },
          }),
        [],
      ),
    ]);

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "gdpr.data_exported",
    entityType: "User",
    entityId: user.id,
  }).catch(() => undefined);

  const exportPayload = {
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    controller: "KDILGAMES (Croatia, EU)",
    account: profile,
    sellerProfile,
    orders,
    reviews,
    wishlist,
    following: follows,
    supportTickets: tickets,
    questions,
    notifications,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const safeUsername = user.username.replace(/[^a-z0-9_-]/gi, "_");

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kdilgames-export-${safeUsername}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
