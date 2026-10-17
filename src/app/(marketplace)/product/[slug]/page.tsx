import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  Download,
  Layers,
  ShieldCheck,
  Star,
} from "lucide-react";

import {
  AddToCartButton,
  ReportForm,
  ReviewForm,
  WishlistButton,
} from "@/components/marketplace/product-actions";
import { ProductGallery } from "@/components/marketplace/product-gallery";
import { ProductCard } from "@/components/marketplace/product-card";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { addToCartAction, reportContentAction, submitReviewAction, toggleWishlistAction } from "@/lib/marketplace/actions";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PRODUCT_CARD_SELECT } from "@/lib/queries/products";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

async function loadProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      category: { select: { name: true, slug: true } },
      seller: {
        select: {
          id: true,
          slug: true,
          storeName: true,
          tagline: true,
          logoUrl: true,
          status: true,
          stripeChargesEnabled: true,
          user: { select: { createdAt: true, status: true } },
          _count: { select: { products: { where: { status: "PUBLISHED" } }, followers: true } },
        },
      },
      images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
      versions: { orderBy: { releasedAt: "desc" }, select: { version: true, changelog: true, releasedAt: true, isLatest: true } },
      _count: { select: { files: { where: { isActive: true } }, reviews: { where: { status: "PUBLISHED" } } } },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, shortDescription: true, thumbnailUrl: true },
  });

  if (!product) return { title: "Product not found" };

  return {
    title: product.title,
    description: product.shortDescription,
    openGraph: {
      title: product.title,
      description: product.shortDescription,
      images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  // View counting is a best-effort metric, never a source of truth for money.
  await prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } });

  const user = await getSessionUser();

  const [ownedItem, wishlisted, reviews, related] = await Promise.all([
    user
      ? prisma.orderItem.findFirst({
          where: {
            productId: product.id,
            order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
          },
          select: { id: true, orderId: true },
        })
      : null,
    user
      ? prisma.wishlistItem.findUnique({
          where: { userId_productId: { userId: user.id, productId: product.id } },
          select: { id: true },
        })
      : null,
    prisma.review.findMany({
      where: { productId: product.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        isVerifiedPurchase: true,
        sellerReply: true,
        sellerRepliedAt: true,
        user: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", categoryId: product.categoryId, id: { not: product.id } },
      select: PRODUCT_CARD_SELECT,
      orderBy: { publishedAt: "desc" },
      take: 4,
    }),
  ]);

  const isOwnProduct = user?.sellerProfile?.id === product.sellerId;
  const price = product.salePriceMinor ?? product.priceMinor;
  const onSale = product.salePriceMinor !== null && product.salePriceMinor < product.priceMinor;
  const rating = product.ratingCount > 0 ? product.ratingSum / product.ratingCount : null;
  const hasReview = reviews.some((review: any) => review.user.username === user?.username);
  const canBuy = product.seller.status === "APPROVED" && product.seller.user.status === "ACTIVE";

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review: any) => review.rating === stars).length,
  }));
  const distributionTotal = reviews.length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <nav className="subtle mb-4 flex items-center gap-1.5 text-[12px]" aria-label="Breadcrumb">
        <Link href="/browse" className="hover:text-ink">
          Browse
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <Link href={`/category/${product.category.slug}`} className="hover:text-ink">
          {product.category.name}
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="truncate text-ink-muted">{product.title}</span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <ProductGallery images={product.images} title={product.title} />
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <div>
                <h2 className="text-[15px] font-semibold">Description</h2>
                <div className="prose-legal mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">
                  {product.description}
                </div>
              </div>

              {product.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag: string) => (
                    <Link key={tag} href={`/browse?tag=${encodeURIComponent(tag)}`} className="badge">
                      {tag}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <SpecList title="Compatibility" value={product.compatibility} />
                <SpecList title="Requirements" value={product.requirements} />
              </div>

              {product.licenseText ? (
                <div>
                  <h3 className="text-[13px] font-semibold">License</h3>
                  <p className="muted mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed">
                    {product.licenseText}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Changelog"
              description={`Current version ${product.version}`}
            />
            {product.versions.length === 0 ? (
              <CardBody>
                <p className="muted text-[12.5px]">
                  No version history has been published for this product yet.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {product.versions.map((version: any) => (
                  <li key={version.version} className="flex gap-3 px-4 py-3">
                    <div className="flex w-24 shrink-0 flex-col gap-1">
                      <span className="text-[12.5px] font-medium tabular-nums">
                        {version.version}
                      </span>
                      <span className="subtle text-[11px]">
                        {version.releasedAt.toISOString().slice(0, 10)}
                      </span>
                    </div>
                    <p className="muted whitespace-pre-wrap text-[12.5px] leading-relaxed">
                      {version.changelog}
                    </p>
                    {version.isLatest ? <Badge tone="positive">latest</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`Reviews${product._count.reviews > 0 ? ` (${product._count.reviews})` : ""}`}
              description="Only buyers with a paid order can review."
            />
            <CardBody className="space-y-4">
              {rating !== null ? (
                <div className="flex flex-wrap items-center gap-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[26px] font-semibold tabular-nums">{rating.toFixed(1)}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={
                            star <= Math.round(rating)
                              ? "size-3.5 fill-caution text-caution"
                              : "size-3.5 text-ink-subtle"
                          }
                          aria-hidden
                        />
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[180px] flex-1 space-y-1">
                    {distribution.map((row) => (
                      <div key={row.stars} className="flex items-center gap-2">
                        <span className="subtle w-3 text-[11px] tabular-nums">{row.stars}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                          <div
                            className="h-full bg-caution"
                            style={{
                              width:
                                distributionTotal > 0
                                  ? `${(row.count / distributionTotal) * 100}%`
                                  : "0%",
                            }}
                          />
                        </div>
                        <span className="subtle w-6 text-right text-[11px] tabular-nums">
                          {row.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {ownedItem && !isOwnProduct ? (
                hasReview ? (
                  <Alert tone="info">You have already reviewed this product.</Alert>
                ) : (
                  <div className="surface-elevated p-4">
                    <h3 className="mb-3 text-[13px] font-semibold">Write a review</h3>
                    <ReviewForm
                      action={submitReviewAction}
                      productId={product.id}
                      orderItemId={ownedItem.id}
                    />
                  </div>
                )
              ) : null}

              {reviews.length === 0 ? (
                <EmptyState
                  title="No reviews yet"
                  description="Reviews appear here once buyers who purchased this product publish one. The marketplace never generates placeholder reviews."
                />
              ) : (
                <ul className="space-y-3">
                  {reviews.map((review: any) => (
                    <li key={review.id} className="surface-elevated p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {review.user.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                            <img
                              src={review.user.avatarUrl}
                              alt=""
                              loading="lazy"
                              className="size-6 shrink-0 rounded-full border border-line object-cover"
                            />
                          ) : (
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-[10px] font-semibold text-ink-muted">
                              {review.user.displayName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="text-[12.5px] font-medium">
                            {review.user.displayName}
                          </span>
                          {review.isVerifiedPurchase ? (
                            <Badge tone="positive">
                              <BadgeCheck className="size-3" aria-hidden />
                              verified purchase
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={
                                star <= review.rating
                                  ? "size-3 fill-caution text-caution"
                                  : "size-3 text-ink-subtle"
                              }
                              aria-hidden
                            />
                          ))}
                          <span className="subtle ml-1.5 text-[11px]">
                            {review.createdAt.toISOString().slice(0, 10)}
                          </span>
                        </div>
                      </div>
                      {review.title ? (
                        <p className="mt-2 text-[13px] font-medium">{review.title}</p>
                      ) : null}
                      <p className="muted mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed">
                        {review.body}
                      </p>
                      {review.sellerReply ? (
                        <div className="mt-3 rounded-[7px] border border-line bg-surface p-3">
                          <p className="subtle text-[11px] uppercase tracking-[0.04em]">
                            Seller reply
                          </p>
                          <p className="muted mt-1 text-[12.5px] leading-relaxed">
                            {review.sellerReply}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {related.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">More in {product.category.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((item) => (
                  <ProductCard key={item.slug} product={item} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardBody className="space-y-4">
              <div>
                <Link
                  href={`/category/${product.category.slug}`}
                  className="subtle text-[11px] uppercase tracking-[0.04em] hover:text-ink"
                >
                  {product.category.name}
                </Link>
                <h1 className="mt-1 text-[18px] font-semibold leading-snug tracking-tight">
                  {product.title}
                </h1>
                <p className="muted mt-1.5 text-[12.5px] leading-relaxed">
                  {product.shortDescription}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                {rating !== null ? (
                  <span className="flex items-center gap-1">
                    <Star className="size-3.5 fill-caution text-caution" aria-hidden />
                    <span className="tabular-nums">{rating.toFixed(1)}</span>
                    <span className="subtle">({product.ratingCount})</span>
                  </span>
                ) : (
                  <Badge>no reviews yet</Badge>
                )}
                {product.salesCount > 0 ? (
                  <span className="tabular-nums">
                    {product.salesCount} {product.salesCount === 1 ? "sale" : "sales"}
                  </span>
                ) : null}
                <span className="tabular-nums">{product.viewCount} views</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-semibold tabular-nums">
                  {formatMoney(price, product.currency)}
                </span>
                {onSale ? (
                  <span className="subtle text-[13px] line-through tabular-nums">
                    {formatMoney(product.priceMinor, product.currency)}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">{product.licenseType.toLowerCase()} license</Badge>
                <Badge>v{product.version}</Badge>
                {product._count.files > 0 ? (
                  <Badge>
                    <Download className="size-3" aria-hidden />
                    {product._count.files} {product._count.files === 1 ? "file" : "files"}
                  </Badge>
                ) : null}
              </div>

              {!canBuy ? (
                <Alert tone="warning">
                  This listing is temporarily unavailable while the seller account is under review.
                </Alert>
              ) : isOwnProduct ? (
                <Alert tone="info">This is your own listing.</Alert>
              ) : ownedItem ? (
                <Link href="/account/orders" className="btn btn-secondary w-full">
                  <Download className="size-4" aria-hidden />
                  You own this — open downloads
                </Link>
              ) : (
                <>
                  <AddToCartButton
                    action={addToCartAction}
                    productId={product.id}
                    next="/cart"
                    disabled={!canBuy}
                  />
                  <WishlistButton
                    action={toggleWishlistAction}
                    productId={product.id}
                    active={Boolean(wishlisted)}
                  />
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sold by" />
            <CardBody>
              <Link href={`/seller/${product.seller.slug}`} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-line bg-elevated text-[13px] font-semibold">
                  {product.seller.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                    <img src={product.seller.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    product.seller.storeName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {product.seller.storeName}
                    <BadgeCheck className="size-3.5 text-accent" aria-hidden />
                  </span>
                  <span className="subtle block text-[11.5px]">
                    {product.seller._count.products} products · {product.seller._count.followers}{" "}
                    followers
                  </span>
                </span>
              </Link>

              <div className="divider my-3" />

              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <ShieldCheck className="size-3.5 text-positive" aria-hidden />
                  Seller reviewed before publishing
                </li>
                <li className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <Layers className="size-3.5 text-accent" aria-hidden />
                  Updates delivered to previous buyers
                </li>
                <li className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <Download className="size-3.5 text-accent" aria-hidden />
                  Private, expiring download links
                </li>
              </ul>

              <div className="mt-3">
                <ReportForm action={reportContentAction} targetType="PRODUCT" targetId={product.id} />
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SpecList({ title, value }: { title: string; value: unknown }) {
  if (!value) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <div>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <pre className="muted mt-1 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
