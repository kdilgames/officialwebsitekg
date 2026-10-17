import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Globe, Mail } from "lucide-react";

import { ProductGrid } from "@/components/marketplace/product-card";
import { FollowButton } from "@/components/marketplace/product-actions";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Pagination } from "@/components/ui/table";
import { toggleFollowAction } from "@/lib/marketplace/actions";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { browseProducts } from "@/lib/queries/products";
import { formatMoney } from "@/lib/money";

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

  const [products, user, ratingAggregate, salesAggregate] = await Promise.all([
    browseProducts({ seller: slug, page, sort: "newest" }),
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

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-7">
      <Card className="overflow-hidden">
        {seller.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
          <img src={seller.logoUrl} alt="" className="h-32 w-full object-cover sm:h-44" />
        ) : (
          <div className="h-20 w-full border-b border-line bg-elevated sm:h-28" />
        )}
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight">{seller.storeName}</h1>
              <BadgeCheck className="size-4 text-accent" aria-hidden />
              <Badge tone="positive">approved seller</Badge>
            </div>
            {seller.tagline ? <p className="muted mt-1.5 text-[13px]">{seller.tagline}</p> : null}
            <div className="subtle mt-2 flex flex-wrap items-center gap-3 text-[12px]">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden />
                Selling since {seller.createdAt.toISOString().slice(0, 7)}
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

          {user && user.id !== seller.user.id ? (
            <FollowButton action={toggleFollowAction} sellerId={seller.id} active={isFollowing} />
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
        <Card className="mt-4">
          <CardHeader title="About this store" />
          <CardBody>
            <p className="muted whitespace-pre-wrap text-[12.5px] leading-relaxed">{seller.about}</p>
          </CardBody>
        </Card>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-[15px] font-semibold">Products</h2>
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
              className="mt-5"
            />
          </>
        )}
      </section>

      <Alert tone="info" className="mt-6">
        Already bought from this seller?{" "}
        <Link href="/account/orders" className="text-accent hover:underline">
          Open your downloads
        </Link>{" "}
        to get the latest version of every purchase.
      </Alert>
    </div>
  );
}
