import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  Download,
  ExternalLink,
  FileArchive,
  History,
  Layers,
  MessageSquare,
  Package,
  Pencil,
  ShieldCheck,
  Star,
} from "lucide-react";

import { FlashSaleBadge } from "@/components/marketplace/flash-sale-badge";
import { MessageSellerForm } from "@/components/marketplace/message-forms";
import {
  AddToCartButton,
  AnswerQuestionForm,
  AskQuestionForm,
  FreeClaimButton,
  ReportForm,
  ReviewForm,
  WishlistButton,
} from "@/components/marketplace/product-actions";
import {
  ProductDetailTabs,
  ProductTabJumpButton,
} from "@/components/marketplace/product-detail-tabs";
import { ProductGallery } from "@/components/marketplace/product-gallery";
import { ProductCard } from "@/components/marketplace/product-card";
import { ProductUpdateModalTrigger } from "@/components/marketplace/product-update-modal";
import { SellerBadges } from "@/components/marketplace/seller-badges";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BBCodeContent } from "@/components/ui/bbcode-content";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  addToCartAction,
  answerProductQuestionAction,
  askProductQuestionAction,
  hideProductQuestionAction,
  reportContentAction,
  submitReviewAction,
  toggleWishlistAction,
} from "@/lib/marketplace/actions";
import {
  getEffectivePriceMinor,
  isFlashSaleActive,
  isSaleActive,
} from "@/lib/marketplace/flash-sale";
import { startConversationAction } from "@/lib/messages/actions";
import { claimFreeProductAction } from "@/lib/payments/actions";
import { computeSellerBadges } from "@/lib/seller/badges";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { env, isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { normalizeProductTab } from "@/lib/product-tabs";
import { PRODUCT_CARD_SELECT } from "@/lib/queries/products";
import { buildProductJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { parseUpdateChangelog } from "@/lib/update-format";
import { formatBytes } from "@/lib/upload-rules";
import { safeHttpUrl } from "@/lib/utils/media";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const PRODUCT_SHARED_RELATIONS = {
  category: {
    select: {
      name: true,
      slug: true,
      parent: { select: { name: true, slug: true } },
    },
  },
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
      _count: { select: { products: { where: { status: "PUBLISHED" as const } }, followers: true } },
    },
  },
  images: { orderBy: { sortOrder: "asc" as const }, select: { url: true, alt: true } },
  files: {
    where: { isActive: true },
    select: { id: true, fileName: true, sizeBytes: true, scanStatus: true, versionId: true },
  },
  versions: {
    orderBy: { releasedAt: "desc" as const },
    select: { id: true, version: true, changelog: true, releasedAt: true, isLatest: true },
  },
  _count: {
    select: {
      files: { where: { isActive: true } },
      reviews: { where: { status: "PUBLISHED" as const } },
    },
  },
};

const PRODUCT_BASE_SELECT = {
  id: true,
  sellerId: true,
  categoryId: true,
  title: true,
  slug: true,
  shortDescription: true,
  description: true,
  priceMinor: true,
  salePriceMinor: true,
  currency: true,
  licenseType: true,
  licenseText: true,
  thumbnailUrl: true,
  tags: true,
  version: true,
  compatibility: true,
  requirements: true,
  viewCount: true,
  salesCount: true,
  ratingSum: true,
  ratingCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  ...PRODUCT_SHARED_RELATIONS,
};

async function loadProduct(slug: string) {
  return withSchemaFallback(
    () =>
      prisma.product.findFirst({
        where: { slug, status: "PUBLISHED" },
        select: {
          ...PRODUCT_BASE_SELECT,
          demoUrl: true,
          videoUrl: true,
          saleEndsAt: true,
        },
      }),
    async () =>
      withSchemaFallback(
        async () => {
          const mid = await prisma.product.findFirst({
            where: { slug, status: "PUBLISHED" },
            select: {
              ...PRODUCT_BASE_SELECT,
              demoUrl: true,
              videoUrl: true,
            },
          });
          return mid ? { ...mid, saleEndsAt: null as Date | null } : null;
        },
        async () => {
          const legacy = await prisma.product.findFirst({
            where: { slug, status: "PUBLISHED" },
            select: PRODUCT_BASE_SELECT,
          });
          return legacy
            ? { ...legacy, demoUrl: null, videoUrl: null, saleEndsAt: null as Date | null }
            : null;
        },
      ),
  );
}

function safeOgImageUrl(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return safeHttpUrl(trimmed) ?? undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await prisma.product.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { title: true, shortDescription: true, thumbnailUrl: true },
    });

    if (!product) return { title: "Product not found" };

    const ogImage = safeOgImageUrl(product.thumbnailUrl);

    return {
      title: product.title,
      description: product.shortDescription,
      openGraph: {
        title: product.title,
        description: product.shortDescription,
        images: ogImage ? [ogImage] : undefined,
      },
    };
  } catch {
    return { title: "Product" };
  }
}

function formatCalendarDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const initialTab = normalizeProductTab(query.tab);

  const product = await loadProduct(slug);
  if (!product) notFound();

  // View counting is a best-effort metric, never a source of truth for money.
  await prisma.product
    .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  const user = await getSessionUser();

  const [ownedItem, wishlisted, reviews, questions, bundlesContaining, related] = await Promise.all([
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
    withSchemaFallback(
      () =>
        prisma.productQuestion.findMany({
          where: { productId: product.id, isHidden: false },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            question: true,
            answer: true,
            answeredAt: true,
            createdAt: true,
            user: { select: { username: true, displayName: true, avatarUrl: true } },
          },
        }),
      [],
    ),
    withSchemaFallback(
      () =>
        prisma.productBundle.findMany({
          where: {
            isActive: true,
            seller: { status: "APPROVED", user: { status: "ACTIVE" } },
            items: {
              some: { productId: product.id },
              every: { product: { status: "PUBLISHED" } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            title: true,
            slug: true,
            bundlePriceMinor: true,
            currency: true,
            items: {
              select: {
                product: { select: { priceMinor: true, salePriceMinor: true } },
              },
            },
          },
        }),
      [],
    ),
    prisma.product.findMany({
      where: { status: "PUBLISHED", categoryId: product.categoryId, id: { not: product.id } },
      select: PRODUCT_CARD_SELECT,
      orderBy: { publishedAt: "desc" },
      take: 4,
    }),
  ]);

  const isOwnProduct = user?.sellerProfile?.id === product.sellerId;
  const canManageQuestions = isOwnProduct || user?.role === "ADMIN";
  const price = getEffectivePriceMinor(product);
  const isFree = price === 0;
  const onSale = isSaleActive(product);
  const flashSaleActive = isFlashSaleActive(product);
  const flashSaleEndsIso =
    flashSaleActive && product.saleEndsAt ? product.saleEndsAt.toISOString() : null;
  const discountPercent =
    onSale && product.priceMinor > 0
      ? Math.round(((product.priceMinor - price) / product.priceMinor) * 100)
      : 0;
  const rating = product.ratingCount > 0 ? product.ratingSum / product.ratingCount : null;
  const sellerBadges = computeSellerBadges({
    isApproved: product.seller.status === "APPROVED",
    salesCount: product.salesCount,
    publishedProductsCount: product.seller._count.products,
    ratingAverage: rating,
    ratingCount: product.ratingCount,
    createdAt: product.seller.user.createdAt,
    latestUpdateAt: product.versions[0]?.releasedAt ?? null,
  });
  const hasReview = reviews.some((review) => review.user.username === user?.username);
  const canBuy = product.seller.status === "APPROVED" && product.seller.user.status === "ACTIVE";
  const safeDemoUrl = safeHttpUrl(product.demoUrl);
  const hasCleanScan = product.files.some((file) => file.scanStatus === "CLEAN");
  const totalFileBytes = product.files.reduce((sum, file) => sum + file.sizeBytes, 0);

  const filesByVersionId = new Map<string, typeof product.files>();
  for (const file of product.files) {
    if (!file.versionId) continue;
    const list = filesByVersionId.get(file.versionId) ?? [];
    list.push(file);
    filesByVersionId.set(file.versionId, list);
  }

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => review.rating === stars).length,
  }));
  const distributionTotal = reviews.length;

  const overviewContent = (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <ProductGallery
          images={product.images}
          title={product.title}
          videoUrl={product.videoUrl}
        />
      </Card>

      <Card>
        <CardBody className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-[16px] font-semibold">About this product</h2>
            <BBCodeContent value={product.description} className="mt-2.5" />
          </div>

          {product.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-t border-line pt-4">
              {product.tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/browse?tag=${encodeURIComponent(tag)}`}
                  className="badge transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
                >
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}

          {product.compatibility || product.requirements ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SpecList title="Compatibility" value={product.compatibility} />
              <SpecList title="Requirements" value={product.requirements} />
            </div>
          ) : null}

          {product.licenseText ? (
            <div className="surface-elevated p-4">
              <h3 className="text-[13.5px] font-semibold text-ink">License terms</h3>
              <p className="muted mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">
                {product.licenseText}
              </p>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );

  const updatesContent = (
    <div className="space-y-4">
      {product.versions.length === 0 ? (
        <Card>
          <CardBody className="p-6">
            <EmptyState
              icon={<History className="size-5" aria-hidden />}
              title="No updates published yet"
              description="Version releases and rich release notes published by the creator will appear here."
            />
          </CardBody>
        </Card>
      ) : (
        product.versions.map((version) => {
          const parsed = parseUpdateChangelog(version.changelog);
          const attachedFiles = filesByVersionId.get(version.id) ?? [];

          return (
            <Card key={version.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-elevated/45 px-5 py-3.5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate text-[15px] font-semibold text-ink">
                    {parsed.title ?? `Release v${version.version}`}
                  </h2>
                  <Badge className="font-mono">v{version.version}</Badge>
                  {version.isLatest ? <Badge tone="positive">Latest</Badge> : null}
                </div>
                <time
                  dateTime={version.releasedAt.toISOString()}
                  className="subtle shrink-0 text-[12px]"
                >
                  {formatCalendarDate(version.releasedAt)}
                </time>
              </div>
              <CardBody className="space-y-4 p-5">
                {parsed.body ? (
                  <BBCodeContent value={parsed.body} />
                ) : (
                  <p className="subtle text-[13px]">
                    Version v{version.version} was published without additional changelog notes.
                  </p>
                )}

                {attachedFiles.length > 0 || (ownedItem && !isOwnProduct && version.isLatest) ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {attachedFiles.map((file) => (
                        <span key={file.id} className="badge text-[11.5px]">
                          <FileArchive className="size-3 text-accent" aria-hidden />
                          <span>{file.fileName}</span>
                          <span className="subtle tabular-nums">
                            ({formatBytes(file.sizeBytes)})
                          </span>
                        </span>
                      ))}
                    </div>
                    {ownedItem && !isOwnProduct && version.isLatest ? (
                      <Link
                        href="/account/orders"
                        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
                      >
                        <Download className="size-3.5" aria-hidden />
                        Download update
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );

  const reviewsContent = (
    <Card>
      <CardHeader
        title={`Customer reviews${product._count.reviews > 0 ? ` (${product._count.reviews})` : ""}`}
        description="Verified purchases only."
      />
      <CardBody className="space-y-5 p-5 sm:p-6">
        {rating !== null ? (
          <div className="flex flex-wrap items-center gap-6 rounded-[10px] border border-line bg-elevated/60 p-4">
            <div className="flex items-center gap-3">
              <span className="text-[32px] font-bold tabular-nums leading-none text-ink">
                {rating.toFixed(1)}
              </span>
              <div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={
                        star <= Math.round(rating)
                          ? "size-4 fill-caution text-caution"
                          : "size-4 text-line-strong"
                      }
                      aria-hidden
                    />
                  ))}
                </div>
                <p className="subtle mt-1 text-[12px]">
                  {product.ratingCount}{" "}
                  {product.ratingCount === 1 ? "verified review" : "verified reviews"}
                </p>
              </div>
            </div>
            <div className="min-w-[180px] flex-1 space-y-1.5">
              {distribution.map((row) => (
                <div key={row.stars} className="flex items-center gap-2">
                  <span className="subtle w-3 text-[11.5px] tabular-nums">{row.stars}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full bg-caution"
                      style={{
                        width:
                          distributionTotal > 0
                            ? `${(row.count / distributionTotal) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span className="subtle w-6 text-right text-[11.5px] tabular-nums">
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
              <h3 className="mb-3 text-[14px] font-semibold">Write a review</h3>
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
            description="Reviews appear here once customers who purchased this product share their feedback."
          />
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="surface-elevated p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {review.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                      <img
                        src={review.user.avatarUrl}
                        alt=""
                        loading="lazy"
                        className="size-7 shrink-0 rounded-full border border-line object-cover"
                      />
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[11px] font-semibold text-ink-muted">
                        {review.user.displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="text-[13px] font-semibold text-ink">
                      {review.user.displayName}
                    </span>
                    {review.isVerifiedPurchase ? (
                      <Badge tone="positive">
                        <BadgeCheck className="size-3" aria-hidden />
                        Verified purchase
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={
                          star <= review.rating
                            ? "size-3.5 fill-caution text-caution"
                            : "size-3.5 text-line-strong"
                        }
                        aria-hidden
                      />
                    ))}
                    <span className="subtle ml-2 text-[11.5px]">
                      {review.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </div>
                </div>
                {review.title ? (
                  <p className="mt-2.5 text-[13.5px] font-semibold text-ink">{review.title}</p>
                ) : null}
                <p className="muted mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">
                  {review.body}
                </p>
                {review.sellerReply ? (
                  <div className="mt-3 rounded-[8px] border border-line bg-surface p-3.5">
                    <p className="subtle text-[11px] font-semibold uppercase tracking-[0.04em]">
                      Seller reply
                    </p>
                    <p className="muted mt-1 text-[13px] leading-relaxed">{review.sellerReply}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );

  const qaContent = (
    <Card id="qa">
      <CardHeader
        title={`Questions & answers${questions.length > 0 ? ` (${questions.length})` : ""}`}
        description="Ask the creator about dependencies, compatibility, or included files before buying."
      />
      <CardBody className="space-y-5 p-5 sm:p-6">
        {user && !isOwnProduct ? (
          <div className="surface-elevated p-4">
            <AskQuestionForm action={askProductQuestionAction} productId={product.id} />
          </div>
        ) : !user ? (
          <div className="surface-elevated flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="muted text-[13px]">
              Have a question before buying? Sign in to ask the creator directly.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/product/${product.slug}?tab=qa#qa`)}`}
              className={buttonClass("secondary", "sm")}
            >
              Sign in to ask
            </Link>
          </div>
        ) : null}

        {questions.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-5" aria-hidden />}
            title="No questions yet"
            description="Pre-sale questions from buyers and official answers from the creator appear here."
          />
        ) : (
          <ul className="space-y-3">
            {questions.map((item) => (
              <li key={item.id} className="surface-elevated p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                      <img
                        src={item.user.avatarUrl}
                        alt=""
                        loading="lazy"
                        className="size-6 shrink-0 rounded-full border border-line object-cover"
                      />
                    ) : (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10.5px] font-semibold text-ink-muted">
                        {item.user.displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="text-[12.5px] font-semibold text-ink">
                      {item.user.displayName}
                    </span>
                    <span className="subtle text-[11.5px]">
                      {item.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </div>
                  {canManageQuestions ? (
                    <form action={hideProductQuestionAction}>
                      <input type="hidden" name="questionId" value={item.id} />
                      <button type="submit" className="subtle text-[11.5px] hover:text-critical">
                        Hide
                      </button>
                    </form>
                  ) : null}
                </div>

                <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                  {item.question}
                </p>

                {item.answer ? (
                  <div className="mt-3 rounded-[8px] border border-line bg-surface p-3.5">
                    <div className="flex items-center gap-2">
                      <Badge tone="positive">Creator answer</Badge>
                      {item.answeredAt ? (
                        <span className="subtle text-[11px]">
                          {item.answeredAt.toISOString().slice(0, 10)}
                        </span>
                      ) : null}
                    </div>
                    <p className="muted mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                ) : (
                  <p className="subtle mt-2 text-[12px]">Awaiting creator reply.</p>
                )}

                {canManageQuestions ? (
                  <AnswerQuestionForm
                    action={answerProductQuestionAction}
                    questionId={item.id}
                    defaultAnswer={item.answer}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );

  const productJsonLd = buildProductJsonLd({
    siteUrl: env.siteUrl,
    slug: product.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    imageUrls: [
      ...(product.thumbnailUrl ? [product.thumbnailUrl] : []),
      ...product.images.map((img) => img.url),
    ],
    categoryName: product.category.name,
    sellerName: product.seller.storeName,
    sellerSlug: product.seller.slug,
    priceMinor: product.priceMinor,
    salePriceMinor: product.salePriceMinor,
    saleEndsAt: product.saleEndsAt,
    currency: product.currency,
    version: product.version,
    ratingSum: product.ratingSum,
    ratingCount: product.ratingCount,
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
      />
      <nav
        className="subtle mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px]"
        aria-label="Breadcrumb"
      >
        <Link href="/browse" className="hover:text-ink">
          Browse
        </Link>
        {product.category.parent ? (
          <>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={`/category/${product.category.parent.slug}`} className="hover:text-ink">
              {product.category.parent.name}
            </Link>
          </>
        ) : null}
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href={`/category/${product.category.slug}`} className="hover:text-ink">
          {product.category.name}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate font-medium text-ink-muted">{product.title}</span>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="text-[24px] font-bold leading-snug tracking-tight text-ink sm:text-[27px]">
            {product.title}
          </h1>
          <span className="rounded-[6px] border border-line bg-elevated px-2 py-0.5 font-mono text-[13px] font-medium text-ink-muted">
            v{product.version}
          </span>
        </div>
        <p className="muted mt-1.5 max-w-3xl text-[14.5px] leading-relaxed">
          {product.shortDescription}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <ProductDetailTabs
            initialTab={initialTab}
            updatesCount={product.versions.length}
            reviewsCount={product._count.reviews}
            questionsCount={questions.length}
            overviewContent={overviewContent}
            updatesContent={updatesContent}
            reviewsContent={reviewsContent}
            qaContent={qaContent}
          />

          {related.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 text-[18px] font-semibold tracking-tight">
                More in {product.category.name}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((item) => (
                  <ProductCard key={item.slug} product={item} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {isOwnProduct ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/products/${product.id}`}
                className={buttonClass("secondary", "sm", "flex-1")}
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Link>
              <ProductUpdateModalTrigger
                productId={product.id}
                productSlug={product.slug}
                productTitle={product.title}
                currentVersion={product.version}
                activeFileCount={product.files.length}
                isSupabaseConfigured={isSupabaseConfigured}
                maxFileBytes={env.uploads.maxFileBytes}
              />
            </div>
          ) : null}

          <Card>
            <CardBody className="space-y-4 p-5">
              <div className="flex flex-wrap items-baseline gap-2.5 border-b border-line pb-3.5">
                {isFree ? (
                  <span className="text-[28px] font-bold tracking-tight text-positive">Free</span>
                ) : (
                  <span className="text-[28px] font-bold tracking-tight tabular-nums text-ink">
                    {formatMoney(price, product.currency)}
                  </span>
                )}
                {onSale && !isFree ? (
                  <>
                    <span className="subtle text-[14px] line-through tabular-nums">
                      {formatMoney(product.priceMinor, product.currency)}
                    </span>
                    {discountPercent > 0 ? (
                      <Badge tone="accent">Save {discountPercent}%</Badge>
                    ) : null}
                  </>
                ) : null}
              </div>

              {flashSaleEndsIso ? <FlashSaleBadge saleEndsAt={flashSaleEndsIso} /> : null}

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
                  This listing is temporarily unavailable while the seller store is under review.
                </Alert>
              ) : isOwnProduct ? (
                <Alert tone="info">This is your own listing.</Alert>
              ) : ownedItem ? (
                <Link href="/account/orders" className="btn btn-secondary w-full">
                  <Download className="size-4" aria-hidden />
                  You own this — open downloads
                </Link>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {isFree ? (
                    <FreeClaimButton
                      action={claimFreeProductAction}
                      productId={product.id}
                      next="/account/orders"
                      disabled={!canBuy}
                    />
                  ) : (
                    <AddToCartButton
                      action={addToCartAction}
                      productId={product.id}
                      next="/cart"
                      disabled={!canBuy}
                    />
                  )}
                  <WishlistButton
                    action={toggleWishlistAction}
                    productId={product.id}
                    active={Boolean(wishlisted)}
                  />
                </div>
              )}

              {safeDemoUrl ? (
                <a
                  href={safeDemoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary w-full"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Live demo
                </a>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="surface-elevated px-3 py-2 text-center">
                  <p className="text-[14px] font-semibold tabular-nums text-ink">
                    {product.viewCount.toLocaleString("en-US")}
                  </p>
                  <p className="subtle text-[11px]">Views</p>
                </div>
                <div className="surface-elevated px-3 py-2 text-center">
                  <p className="text-[14px] font-semibold tabular-nums text-ink">
                    {product.salesCount.toLocaleString("en-US")}
                  </p>
                  <p className="subtle text-[11px]">Purchases</p>
                </div>
                <div className="surface-elevated px-3 py-2 text-center">
                  <p className="text-[12.5px] font-semibold text-ink">
                    {formatCalendarDate(product.publishedAt ?? product.createdAt)}
                  </p>
                  <p className="subtle text-[11px]">Published</p>
                </div>
                <div className="surface-elevated px-3 py-2 text-center">
                  <p className="text-[12.5px] font-semibold text-ink">
                    {formatCalendarDate(product.updatedAt)}
                  </p>
                  <p className="subtle text-[11px]">Updated</p>
                </div>
                <ProductTabJumpButton
                  targetTab="reviews"
                  className="surface-elevated px-3 py-2 text-center transition-colors hover:border-line-strong"
                >
                  <p className="flex items-center justify-center gap-1 text-[12.5px] font-semibold text-ink">
                    {rating !== null ? (
                      <>
                        <Star className="size-3.5 fill-caution text-caution" aria-hidden />
                        <span className="tabular-nums">{rating.toFixed(1)}</span>
                        <span className="subtle font-normal">({product.ratingCount})</span>
                      </>
                    ) : (
                      <span className="text-ink-muted">Not yet rated</span>
                    )}
                  </p>
                  <p className="subtle text-[11px]">Rating</p>
                </ProductTabJumpButton>
                <div className="surface-elevated px-3 py-2 text-center">
                  <p className="text-[12.5px] font-semibold tabular-nums text-ink">
                    {totalFileBytes > 0 ? formatBytes(totalFileBytes) : "—"}
                  </p>
                  <p className="subtle text-[11px]">File size</p>
                </div>
              </div>

              {product.tags.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-1.5 border-t border-line pt-3">
                  {product.tags.map((tag: string) => (
                    <Link
                      key={`aside-${tag}`}
                      href={`/browse?tag=${encodeURIComponent(tag)}`}
                      className="badge transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          {bundlesContaining.length > 0 ? (
            <Card>
              <CardHeader title="Included in creator bundle" />
              <CardBody className="space-y-2.5 p-4">
                {bundlesContaining.map((bundle) => {
                  const regularSum = bundle.items.reduce(
                    (sum, item) => sum + (item.product.salePriceMinor ?? item.product.priceMinor),
                    0,
                  );
                  return (
                    <Link
                      key={bundle.id}
                      href={`/bundle/${bundle.slug}`}
                      className="surface-elevated block p-3 transition-colors hover:border-line-strong"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                          <Package className="size-3.5 shrink-0 text-accent" aria-hidden />
                          <span className="line-clamp-1">{bundle.title}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                          {bundle.bundlePriceMinor === 0
                            ? "Free"
                            : formatMoney(bundle.bundlePriceMinor, bundle.currency)}
                        </span>
                      </div>
                      <p className="subtle mt-1 flex items-center justify-between text-[11.5px]">
                        <span>{bundle.items.length} products included</span>
                        {regularSum > bundle.bundlePriceMinor ? (
                          <span className="line-through tabular-nums">
                            {formatMoney(regularSum, bundle.currency)}
                          </span>
                        ) : null}
                      </p>
                    </Link>
                  );
                })}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Creator" />
            <CardBody className="p-5">
              <Link href={`/seller/${product.seller.slug}`} className="group flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-elevated text-[14px] font-semibold text-ink">
                  {product.seller.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                    <img src={product.seller.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    product.seller.storeName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink group-hover:text-accent">
                    {product.seller.storeName}
                    <BadgeCheck className="size-4 text-accent" aria-hidden />
                  </span>
                  <span className="subtle block text-[12px]">
                    {product.seller._count.products} products · {product.seller._count.followers}{" "}
                    followers
                  </span>
                </span>
              </Link>

              <div className="mt-3">
                <SellerBadges badges={sellerBadges} />
              </div>

              {user && !isOwnProduct ? (
                <div className="mt-3">
                  <MessageSellerForm
                    action={startConversationAction}
                    sellerId={product.seller.id}
                    sellerName={product.seller.storeName}
                    productId={product.id}
                    defaultSubject={`Question about ${product.title}`}
                  />
                </div>
              ) : null}

              <div className="divider my-4" />

              <ul className="space-y-2.5">
                <li className="flex items-center gap-2.5 text-[12.5px] text-ink-muted">
                  <ShieldCheck className="size-4 shrink-0 text-positive" aria-hidden />
                  Store reviewed by KDILGAMES staff
                </li>
                <li className="flex items-start gap-2.5 text-[12.5px] text-ink-muted">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                  <Link href="/support#verification" className="hover:text-ink hover:underline">
                    {hasCleanScan
                      ? "Scanned via automated malware check"
                      : "Executables blocked by extension policy · Manually reviewed"}
                  </Link>
                </li>
                <li className="flex items-center gap-2.5 text-[12.5px] text-ink-muted">
                  <Layers className="size-4 shrink-0 text-accent" aria-hidden />
                  Future updates included for buyers
                </li>
                <li className="flex items-center gap-2.5 text-[12.5px] text-ink-muted">
                  <Download className="size-4 shrink-0 text-accent" aria-hidden />
                  Instant private download after {isFree ? "claiming" : "checkout"}
                </li>
              </ul>

              <div className="mt-4">
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
    <div className="surface-elevated p-4">
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      <pre className="muted mt-1.5 whitespace-pre-wrap font-sans text-[13px] leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
