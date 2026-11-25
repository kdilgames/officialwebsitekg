import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Globe, Mail } from "lucide-react";

import { BundleCard } from "@/components/marketplace/bundle-card";
import { MessageSellerForm } from "@/components/marketplace/message-forms";
import { ProductGrid } from "@/components/marketplace/product-card";
import { FollowButton } from "@/components/marketplace/product-actions";
import { SellerBadges } from "@/components/marketplace/seller-badges";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Pagination } from "@/components/ui/table";
import { toggleFollowAction } from "@/lib/marketplace/actions";
import { startConversationAction } from "@/lib/messages/actions";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { browseProducts, listPublishedBundles } from "@/lib/queries/products";
import { formatMoney } from "@/lib/money";
import { computeSellerBadges } from "@/lib/seller/badges";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
};

async function loadSeller(slug: string) {
  return prisma.sellerProfile.findFirst({
    where: { slug, status: "APPROVED", user: { status: "ACTIVE" } },
    select: {
      id: true,
      slug: true,
      storeName: true,
      tagline: true,
      about: true,
      logoUrl: true,
      bannerUrl: true,
      country: true,
      websiteUrl: true,
      supportEmail: true,
      createdAt: true,
      user: { select: { id: true, createdAt: true } },
      _count: { select: { products: { where: { status: "PUBLISHED" } }, followers: true } },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const seller = await loadSeller(slug);
  return {
    title: seller ? seller.storeName : "Seller not found",
    description: seller?.tagline ?? undefined,
  };
}

export default async function SellerPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const seller = await loadSeller(slug);
  if (!seller) notFound();

  const page = Number.parseInt(query.page ?? "1", 10) || 1;

  const [products, bundles, user, ratingAggregate, salesAggregate, latestVersion] = await Promise.all([
    browseProducts({ seller: slug, page, sort: "newest" }),
    listPublishedBundles(6, seller.id),
    getSessionUser(),
    prisma.review.aggregate({
      where: { status: "PUBLISHED", product: { sellerId: seller.id } },
      _sum: { rating: true },
      _count: { rating: true },
    }),
    prisma.orderItem.aggregate({
      where: { sellerId: seller.id, status: { in: ["PAID", "REFUNDED"] } },
      _sum: { priceMinor: true },
      _count: { _all: true },
    }),
    prisma.productVersion.findFirst({
      where: { product: { sellerId: seller.id } },
      orderBy: { releasedAt: "desc" },
      select: { releasedAt: true },
    }),
  ]);

  const isFollowing = user
    ? Boolean(
        await prisma.follow.findUnique({
          where: { followerId_sellerId: { followerId: user.id, sellerId: seller.id } },
          select: { id: true },
        }),
      )
    : false;

  const ratingCount = ratingAggregate._count.rating;
  const rating = ratingCount > 0 ? (ratingAggregate._sum.rating ?? 0) / ratingCount : null;
  const grossSalesMinor = salesAggregate._sum.priceMinor ?? 0;
  const salesCount = salesAggregate._count._all;
  const coverImage = seller.bannerUrl ?? seller.logoUrl;
  const badges = computeSellerBadges({
    isApproved: true,
    salesCount,
    publishedProductsCount: seller._count.products,
    ratingAverage: rating,
    ratingCount,
    createdAt: seller.createdAt,
    latestUpdateAt: latestVersion?.releasedAt ?? null,
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
          <img src={coverImage} alt="" className="h-36 w-full border-b border-line object-cover sm:h-48" />
        ) : (
          <div className="h-24 w-full border-b border-line bg-elevated sm:h-32" />
        )}
        <CardBody className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-line bg-elevated text-[18px] font-bold text-ink">
              {seller.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                <img src={seller.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                seller.storeName.slice(0, 1).toUpperCase()
              )}
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-ink">{seller.storeName}</h1>
                <BadgeCheck className="size-4 text-accent" aria-hidden />
              </div>
              <div className="mt-1.5">
                <SellerBadges badges={badges} />
              </div>
              {seller.tagline ? (
                <p className="muted mt-1.5 text-[13.5px]">{seller.tagline}</p>
              ) : null}
              <div className="subtle mt-2.5 flex flex-wrap items-center gap-4 text-[12.5px]">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Member since {seller.createdAt.toISOString().slice(0, 7)}
                </span>
                {seller.country ? <span>Based in {seller.country}</span> : null}
                {seller.websiteUrl ? (
                  <a
                    href={seller.websiteUrl}
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="flex items-center gap-1.5 hover:text-ink"
                  >
                    <Globe className="size-3.5" aria-hidden />
                    Website
                  </a>
                ) : null}
                {seller.supportEmail ? (
                  <a
                    href={`mailto:${seller.supportEmail}`}
                    className="flex items-center gap-1.5 hover:text-ink"
                  >
                    <Mail className="size-3.5" aria-hidden />
                    Support
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {user && user.id !== seller.user.id ? (
            <div className="flex flex-col items-end gap-2">
              <FollowButton action={toggleFollowAction} sellerId={seller.id} active={isFollowing} />
              <div className="w-full min-w-[240px] max-w-[320px]">
                <MessageSellerForm
                  action={startConversationAction}
                  sellerId={seller.id}
                  sellerName={seller.storeName}
                />
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published products" value={String(seller._count.products)} />
        <StatCard label="Followers" value={String(seller._count.followers)} />
        <StatCard
          label="Buyer rating"
          value={rating !== null ? rating.toFixed(1) : "—"}
          hint={ratingCount > 0 ? `${ratingCount} verified reviews` : "No reviews yet"}
          tone={rating !== null ? "positive" : "neutral"}
        />
        <StatCard
          label="Lifetime sales"
          value={String(salesCount)}
          hint={salesCount > 0 ? `${formatMoney(grossSalesMinor, "EUR")} gross` : "No sales yet"}
        />
      </div>

      {seller.about ? (
        <Card className="mt-5">
          <CardHeader title="About this store" />
          <CardBody>
            <p className="muted whitespace-pre-wrap text-[13.5px] leading-relaxed">{seller.about}</p>
          </CardBody>
        </Card>
      ) : null}

      {bundles.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-4 text-[18px] font-semibold tracking-tight">Creator bundles</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((bundle) => (
              <BundleCard key={bundle.id} bundle={bundle} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-4 text-[18px] font-semibold tracking-tight">Products</h2>
        {products.items.length === 0 ? (
          <div className="surface">
            <EmptyState title="No published products yet" />
          </div>
        ) : (
          <>
            <ProductGrid products={products.items} />
            <Pagination
              page={products.page}
              totalPages={products.totalPages}
              buildHref={(next) =>
                next > 1 ? `/seller/${slug}?page=${next}` : `/seller/${slug}`
              }
              className="mt-6"
            />
          </>
        )}
      </section>

      <Alert tone="info" className="mt-8">
        Already purchased from this creator?{" "}
        <Link href="/account/orders" className="font-medium underline">
          Open your downloads
        </Link>{" "}
        to access the latest release of every item you own.
      </Alert>
    </div>
  );
}
