import Link from "next/link";
import { BadgeCheck, Store } from "lucide-react";

import { FollowButton } from "@/components/marketplace/product-actions";
import { ProductGrid } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toggleFollowAction } from "@/lib/marketplace/actions";
import { PRODUCT_CARD_SELECT } from "@/lib/queries/products";

export const dynamic = "force-dynamic";
export const metadata = { title: "Following stores" };

export default async function FollowingPage() {
  const user = await requireUser("/account/following");

  const follows = await prisma.follow.findMany({
    where: {
      followerId: user.id,
      seller: { status: "APPROVED", user: { status: "ACTIVE" } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      seller: {
        select: {
          id: true,
          slug: true,
          storeName: true,
          tagline: true,
          logoUrl: true,
          _count: { select: { products: { where: { status: "PUBLISHED" } } } },
        },
      },
    },
  });

  const sellerIds = follows.map((entry) => entry.seller.id);

  const feedProducts =
    sellerIds.length > 0
      ? await prisma.product.findMany({
          where: { sellerId: { in: sellerIds }, status: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
          take: 16,
          select: PRODUCT_CARD_SELECT,
        })
      : [];

  if (follows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Store className="size-5" aria-hidden />}
          title="No stores followed yet"
          description="Follow creators you trust from their store page to keep track of their newest releases in one feed."
          action={
            <Link href="/browse" className={buttonClass("primary")}>
              Explore stores &amp; products
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Following stores</h1>
        <p className="muted mt-1 text-[12.5px]">
          {follows.length} {follows.length === 1 ? "store" : "stores"} followed · latest releases
          sorted newest first.
        </p>
      </header>

      <Card>
        <ul className="divide-y divide-line">
          {follows.map(({ id, seller }) => (
            <li key={id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <Link href={`/seller/${seller.slug}`} className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-line bg-elevated text-[13px] font-semibold text-ink">
                  {seller.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                    <img src={seller.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    seller.storeName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-accent">
                    <span className="truncate">{seller.storeName}</span>
                    <BadgeCheck className="size-3.5 shrink-0 text-accent" aria-hidden />
                  </span>
                  <span className="subtle block truncate text-[12px]">
                    {seller._count.products} products
                    {seller.tagline ? ` · ${seller.tagline}` : ""}
                  </span>
                </span>
              </Link>

              <FollowButton action={toggleFollowAction} sellerId={seller.id} active />
            </li>
          ))}
        </ul>
      </Card>

      <section>
        <h2 className="mb-3 text-[16px] font-semibold tracking-tight">
          Latest releases from creators you follow
        </h2>
        {feedProducts.length === 0 ? (
          <Card>
            <EmptyState
              title="No published releases yet"
              description="New releases published by the stores you follow will appear here automatically."
            />
          </Card>
        ) : (
          <ProductGrid products={feedProducts} />
        )}
      </section>
    </div>
  );
}
