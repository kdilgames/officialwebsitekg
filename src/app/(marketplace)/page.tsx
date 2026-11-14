import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Download,
  Search,
  ShieldCheck,
  Star,
  Store,
} from "lucide-react";

import { BundleCard } from "@/components/marketplace/bundle-card";
import { getCategoryVisual } from "@/components/marketplace/category-visuals";
import { ProductGrid, type ProductCardData } from "@/components/marketplace/product-card";
import { formatMoney } from "@/lib/money";
import {
  browseProducts,
  listCategories,
  listPublishedBundles,
  topSellers,
} from "@/lib/queries/products";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type BrowseProduct = Awaited<ReturnType<typeof browseProducts>>["items"][number];
type CategoryWithCount = Awaited<ReturnType<typeof listCategories>>[number];
type TopSeller = Awaited<ReturnType<typeof topSellers>>[number];

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const hasAuthCallbackParams =
    typeof params.code === "string" ||
    typeof params.token_hash === "string" ||
    typeof params.error_code === "string";

  if (hasAuthCallbackParams) {
    const forwarded = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.length > 0) forwarded.set(key, value);
    }
    redirect(`/auth/callback?${forwarded.toString()}`);
  }

  const [featured, newest, categories, bestSelling, sellers, bundles, totalPublished] =
    await Promise.all([
      browseProducts({ featuredOnly: true, sort: "newest", perPage: 8 }),
      browseProducts({ sort: "newest", perPage: 8 }),
      listCategories(),
      browseProducts({ sort: "best-selling", perPage: 8 }),
      topSellers(4),
      listPublishedBundles(4),
      prisma.product.count({ where: { status: "PUBLISHED" } }),
    ]);

  const hasSales = bestSelling.items.some((product: BrowseProduct) => product.salesCount > 0);
  const isCatalogueEmpty = totalPublished === 0;

  const showcaseProducts = [...featured.items, ...newest.items]
    .filter(
      (product, index, list) =>
        Boolean(product?.slug) && list.findIndex((entry) => entry.slug === product.slug) === index,
    )
    .slice(0, 3);

  const heroProduct = showcaseProducts[0] ?? null;
  const isHeroFeatured = heroProduct
    ? featured.items.some((item) => item.slug === heroProduct.slug)
    : false;
  const supportingProducts = showcaseProducts.slice(1, 3);
  const topCategories = categories.filter((category: CategoryWithCount) => !category.parentId);
  const displayedCategories = (topCategories.length > 0 ? topCategories : categories).slice(0, 6);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-center lg:gap-12">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
            Digital marketplace for creators &amp; game developers
          </p>

          <h1 className="mt-3 max-w-2xl text-[32px] font-bold leading-[1.12] tracking-[-0.025em] text-ink sm:text-[42px] lg:text-[46px]">
            Quality scripts, plugins, bots, and templates — ready for your project.
          </h1>

          <p className="muted mt-4 max-w-xl text-[15px] leading-relaxed sm:text-[16px]">
            Browse Roblox systems, Minecraft plugins, Discord bots, and website templates made by
            independent creators. Every seller is reviewed, checkout runs through Stripe, and files
            unlock immediately after purchase.
          </p>

          <form
            action="/browse"
            className="surface mt-6 flex max-w-xl items-center gap-2 p-1.5 focus-within:border-accent"
          >
            <div className="relative flex flex-1 items-center">
              <Search
                className="pointer-events-none absolute left-3 size-4 text-ink-subtle"
                aria-hidden
              />
              <input
                type="search"
                name="q"
                placeholder='Try "economy plugin", "Roblox UI kit", "portfolio"...'
                aria-label="Search the marketplace"
                className="h-10 w-full bg-transparent pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none"
              />
            </div>
            <button type="submit" className="btn btn-primary h-10 px-5">
              Search
            </button>
          </form>

          {displayedCategories.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="subtle text-[12px]">Jump to:</span>
              {displayedCategories.map((category: CategoryWithCount) => {
                const visual = getCategoryVisual(category.slug, category.icon);
                const Icon = visual.icon;
                return (
                  <Link
                    key={category.slug}
                    href={`/category/${category.slug}`}
                    className="badge transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
                  >
                    <Icon className="size-3 text-ink-subtle" aria-hidden />
                    {category.name}
                  </Link>
                );
              })}
              <Link
                href="/browse?price=free"
                className="badge badge-positive transition-colors hover:opacity-90"
              >
                Free resources
              </Link>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-line pt-5 text-[13px] text-ink-muted">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-positive" aria-hidden />
              Manually reviewed sellers
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-positive" aria-hidden />
              Verified-purchase reviews
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-positive" aria-hidden />
              Instant file downloads
            </span>
          </div>
        </div>

        <div>
          {heroProduct ? (
            <div className="space-y-3">
              <SpotlightProductCard product={heroProduct} isFeatured={isHeroFeatured} />
              {supportingProducts.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {supportingProducts.map((product) => (
                    <CompactProductCard key={product.slug} product={product} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <EcosystemShowcaseCard categories={displayedCategories} />
          )}
        </div>
      </section>

      {featured.items.length > 0 ? (
        <Section title="Featured picks" subtitle="Selected listings from approved stores" href="/browse">
          <ProductGrid products={featured.items as ProductCardData[]} />
        </Section>
      ) : null}

      {newest.items.length > 0 ? (
        <Section
          title="Newest releases"
          subtitle="Freshly published tools, plugins and templates"
          href="/browse?sort=newest"
        >
          <ProductGrid products={newest.items as ProductCardData[]} />
        </Section>
      ) : null}

      {hasSales ? (
        <Section
          title="Best selling"
          subtitle="Popular listings with proven buyer demand"
          href="/browse?sort=best-selling"
        >
          <ProductGrid products={bestSelling.items as ProductCardData[]} />
        </Section>
      ) : null}

      {bundles.length > 0 ? (
        <Section
          title="Creator bundles"
          subtitle="Multi-item packs curated by creators at a lower combined price"
          href="/browse"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bundles.map((bundle) => (
              <BundleCard key={bundle.id} bundle={bundle} />
            ))}
          </div>
        </Section>
      ) : null}

      {categories.length > 0 ? (
        <Section
          title="Browse by category"
          subtitle="Jump straight into the ecosystem you are building for"
          href="/browse"
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category: CategoryWithCount) => {
              const visual = getCategoryVisual(category.slug, category.icon);
              const Icon = visual.icon;
              return (
                <Link
                  key={category.slug}
                  href={`/category/${category.slug}`}
                  className="surface card-interactive group flex flex-col overflow-hidden"
                >
                  <div
                    className={`relative aspect-[16/9] overflow-hidden border-b border-line ${visual.canvasClass}`}
                  >
                    {visual.imageUrl ? (
                      <Image
                        src={visual.imageUrl}
                        alt={category.name}
                        width={1200}
                        height={670}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] dark:brightness-[0.94] dark:group-hover:brightness-100"
                      />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-2">
                        <span
                          className={`flex size-12 items-center justify-center rounded-[12px] border ${visual.chipClass}`}
                        >
                          <Icon className="size-6" aria-hidden />
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-[8px] border ${visual.chipClass}`}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <h3 className="truncate text-[15.5px] font-semibold text-ink transition-colors group-hover:text-accent">
                          {category.name}
                        </h3>
                      </div>

                      {category._count.products > 0 ? (
                        <span className="subtle shrink-0 text-[12px] tabular-nums">
                          {category._count.products}{" "}
                          {category._count.products === 1 ? "item" : "items"}
                        </span>
                      ) : (
                        <span className="subtle inline-flex shrink-0 items-center gap-1 text-[12px] font-medium transition-colors group-hover:text-accent">
                          Explore
                          <ArrowRight
                            className="size-3.5 transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </span>
                      )}
                    </div>

                    {category.description ? (
                      <p className="muted mt-2.5 text-[13px] leading-relaxed">
                        {category.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      ) : null}

      {isCatalogueEmpty ? (
        <section className="surface mt-10 flex flex-col items-start justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="max-w-xl">
            <span className="badge badge-accent">Opening catalogue</span>
            <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-ink">
              The first creator listings are on the way
            </h2>
            <p className="muted mt-2 text-[14px] leading-relaxed">
              KDILGAMES only displays real products from approved stores — no sample or placeholder
              listings. If you build Roblox systems, Minecraft plugins, Discord bots or web
              templates, you can apply now to be among the first stores on the marketplace.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <Link href="/account/seller" className="btn btn-primary">
              <Store className="size-4" aria-hidden />
              Apply to sell
            </Link>
            <Link href="/browse" className="btn btn-secondary">
              Explore browse page
            </Link>
          </div>
        </section>
      ) : null}

      {sellers.length > 0 ? (
        <Section
          title="Verified creators"
          subtitle="Independent studios and developers selling on KDILGAMES"
          href="/sellers"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sellers.map((seller: TopSeller) => (
              <Link
                key={seller.slug}
                href={`/seller/${seller.slug}`}
                className="surface card-interactive group flex flex-col p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-elevated text-[14px] font-semibold text-ink">
                    {seller.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                      <img src={seller.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      seller.storeName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-ink group-hover:text-accent">
                      <span className="truncate">{seller.storeName}</span>
                      <BadgeCheck className="size-3.5 shrink-0 text-accent" aria-hidden />
                    </p>
                    <p className="subtle text-[12px] tabular-nums">
                      {seller._count.products} {seller._count.products === 1 ? "product" : "products"}{" "}
                      · {seller._count.followers} followers
                    </p>
                  </div>
                </div>
                {seller.tagline ? (
                  <p className="muted mt-3 line-clamp-2 text-[12.5px] leading-relaxed">
                    {seller.tagline}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <section className="surface mt-12 p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
            Built for trust
          </p>
          <h2 className="mt-1.5 text-[20px] font-semibold tracking-tight sm:text-[22px]">
            How buying and selling works on KDILGAMES
          </h2>
        </div>

        <div className="divider my-6" />

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-[8px] border border-line bg-elevated text-accent">
                <BadgeCheck className="size-4" aria-hidden />
              </span>
              <h3 className="text-[14.5px] font-semibold text-ink">Reviewed stores &amp; files</h3>
            </div>
            <p className="muted text-[13px] leading-relaxed">
              Every seller application and product submission is reviewed by platform staff before it
              appears in the store.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-[8px] border border-line bg-elevated text-accent">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <h3 className="text-[14.5px] font-semibold text-ink">Verified buyer reviews</h3>
            </div>
            <p className="muted text-[13px] leading-relaxed">
              Ratings and reviews can only be written by customers who have purchased the item,
              keeping product feedback genuine.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-[8px] border border-line bg-elevated text-accent">
                <Download className="size-4" aria-hidden />
              </span>
              <h3 className="text-[14.5px] font-semibold text-ink">Instant access &amp; updates</h3>
            </div>
            <p className="muted text-[13px] leading-relaxed">
              Once checkout completes via Stripe, your downloads unlock immediately in your account
              along with future version updates.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-elevated mt-8 flex flex-col items-start justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="max-w-2xl">
          <h2 className="text-[20px] font-semibold tracking-tight text-ink sm:text-[22px]">
            Sell your digital products on KDILGAMES
          </h2>
          <p className="muted mt-2 text-[13.5px] leading-relaxed">
            Publish your scripts, plugins, bots, or web templates to a dedicated storefront. Keep
            85% of every sale by default, push updates directly to buyers, and receive payouts
            through Stripe Connect.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2.5">
          <Link href="/account/seller" className="btn btn-primary">
            Start selling
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/legal/fees" className="btn btn-secondary">
            Fees &amp; commissions
          </Link>
        </div>
      </section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="muted mt-0.5 text-[13px]">{subtitle}</p> : null}
        </div>
        <Link href={href} className="btn btn-ghost btn-sm text-ink-muted hover:text-ink">
          View all
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

function SpotlightProductCard({
  product,
  isFeatured,
}: {
  product: BrowseProduct;
  isFeatured: boolean;
}) {
  const price = product.salePriceMinor ?? product.priceMinor;
  const onSale = product.salePriceMinor !== null && product.salePriceMinor < product.priceMinor;
  const visual = getCategoryVisual(product.category.slug);
  const CategoryIcon = visual.icon;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="surface card-interactive group block overflow-hidden"
    >
      <div className={`relative aspect-[2/1] overflow-hidden border-b border-line ${visual.canvasClass}`}>
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
          <img
            src={product.thumbnailUrl}
            alt={product.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <span
              className={`flex size-12 items-center justify-center rounded-[12px] border ${visual.chipClass}`}
            >
              <CategoryIcon className="size-6" aria-hidden />
            </span>
            <span className="subtle text-[12px] font-medium">{product.category.name}</span>
          </div>
        )}
        <span className="badge badge-accent absolute left-3 top-3 shadow-xs">
          {isFeatured ? "Featured" : "Latest release"}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="subtle text-[11.5px] font-medium uppercase tracking-[0.05em]">
            {product.category.name}
          </span>
          {product.ratingCount > 0 ? (
            <span className="flex items-center gap-1 text-[12px] font-medium text-ink">
              <Star className="size-3.5 fill-caution text-caution" aria-hidden />
              {(product.ratingSum / product.ratingCount).toFixed(1)}
              <span className="subtle">({product.ratingCount})</span>
            </span>
          ) : null}
        </div>

        <h2 className="mt-1.5 text-[17px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
          {product.title}
        </h2>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="muted flex items-center gap-1.5 text-[13px]">
            <span>by {product.seller.storeName}</span>
            <BadgeCheck className="size-3.5 text-accent" aria-hidden />
          </p>
          <div className="flex items-baseline gap-1.5">
            {price === 0 ? (
              <span className="text-[16px] font-semibold text-positive">Free</span>
            ) : (
              <span className="text-[16px] font-semibold tabular-nums text-ink">
                {formatMoney(price, product.currency)}
              </span>
            )}
            {onSale ? (
              <span className="subtle text-[12px] line-through tabular-nums">
                {formatMoney(product.priceMinor, product.currency)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function CompactProductCard({ product }: { product: BrowseProduct }) {
  const price = product.salePriceMinor ?? product.priceMinor;
  const visual = getCategoryVisual(product.category.slug);
  const CategoryIcon = visual.icon;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="surface card-interactive group flex items-center gap-3 p-3"
    >
      <div
        className={`flex aspect-[2/1] w-24 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-line ${visual.canvasClass}`}
      >
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
          <img src={product.thumbnailUrl} alt={product.title} className="size-full object-cover" />
        ) : (
          <CategoryIcon className="size-4 text-ink-muted" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[13.5px] font-semibold text-ink group-hover:text-accent">
          {product.title}
        </p>
        <p className="subtle mt-0.5 truncate text-[12px]">{product.seller.storeName}</p>
        <p className={`mt-1 text-[13px] font-semibold ${price === 0 ? "text-positive" : "tabular-nums text-ink"}`}>
          {price === 0 ? "Free" : formatMoney(price, product.currency)}
        </p>
      </div>
    </Link>
  );
}

function EcosystemShowcaseCard({ categories }: { categories: CategoryWithCount[] }) {
  const showcaseCategories = categories.slice(0, 4);

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <div>
          <p className="text-[14px] font-semibold text-ink">Featured ecosystems</p>
          <p className="subtle text-[12px]">Curated categories for digital builds</p>
        </div>
        <Link href="/browse" className="text-[12.5px] font-medium text-accent hover:underline">
          Browse all
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 sm:p-4">
        {showcaseCategories.map((category, index) => {
          const visual = getCategoryVisual(category.slug, category.icon);
          return (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group relative aspect-[16/10] overflow-hidden rounded-[10px] border border-line bg-elevated"
            >
              {visual.imageUrl ? (
                <Image
                  src={visual.imageUrl}
                  alt={category.name}
                  width={1200}
                  height={670}
                  priority={index < 2}
                  sizes="(min-width: 1024px) 22vw, 45vw"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
              ) : null}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
                aria-hidden
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5 sm:p-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-tight text-white sm:text-[13.5px]">
                    {category.name}
                  </p>
                  <p className="truncate text-[11px] text-white/80">{visual.shortLabel}</p>
                </div>
                <ArrowRight
                  className="size-3.5 shrink-0 text-white/85 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-line bg-elevated/60 px-4 py-3 sm:px-5">
        <span className="muted text-[12.5px]">Have scripts or tools to share?</span>
        <Link
          href="/account/seller"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline"
        >
          Open a store
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
