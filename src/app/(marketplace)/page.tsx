import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Download,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { ProductGrid, type ProductCardData } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/alert";
import { browseProducts, listCategories } from "@/lib/queries/products";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const HERO_ILLUSTRATION =
  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=" +
  "premium%20dark%20workspace%20for%20a%20digital%20marketplace%2C%20game%20developer%20assets%20dashboard%20on%20large%20monitor%2C%20subtle%20blue%20interface%20lighting%2C%20clean%20modern%20desk%2C%20minimal%20luxury%20product%20presentation%2C%20realistic%2C%20cinematic%2C%20high-end%20website%20hero%20image" +
  "&image_size=landscape_16_9";
const BUYER_ILLUSTRATION =
  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=" +
  "dark%20premium%20gaming%20developer%20workspace%20with%20marketplace%20product%20browser%20open%2C%20clean%20interface%2C%20subtle%20blue%20lighting%2C%20realistic%20desk%20setup%2C%20high-end%20website%20section%20image%2C%20minimal%20luxury%20style" +
  "&image_size=landscape_16_9";
const SELLER_ILLUSTRATION =
  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=" +
  "premium%20dark%20creator%20workspace%20uploading%20digital%20game%20assets%2C%20dashboard%20with%20product%20analytics%20and%20files%2C%20minimal%20professional%20lighting%2C%20clean%20luxury%20tech%20aesthetic%2C%20realistic" +
  "&image_size=landscape_16_9";

type BrowseProduct = Awaited<ReturnType<typeof browseProducts>>["items"][number];
type CategoryWithCount = Awaited<ReturnType<typeof listCategories>>[number];
type HeroProduct = BrowseProduct;

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

  const [featured, newest, categories, bestSelling] = await Promise.all([
    browseProducts({ featuredOnly: true, sort: "newest", perPage: 8 }),
    browseProducts({ sort: "newest", perPage: 8 }),
    listCategories(),
    browseProducts({ sort: "best-selling", perPage: 8 }),
  ]);

  const hasSales = bestSelling.items.some((product: BrowseProduct) => product.salesCount > 0);
  const totalPublished = await prisma.product.count({ where: { status: "PUBLISHED" } });
  const isCatalogueEmpty = totalPublished === 0;
  const showcaseProducts = [...featured.items, ...newest.items]
    .filter((product, index, list) => Boolean(product?.slug) && list.findIndex((entry) => entry.slug === product.slug) === index)
    .slice(0, 4);
  const heroProduct = showcaseProducts[0] ?? null;
  const supportingProducts = showcaseProducts.slice(1, 4);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <section className="surface hero-shell px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="badge badge-accent">Digital products for game developers</p>
              <p className="badge">
                <Sparkles className="size-3" aria-hidden />
                Clean marketplace experience
              </p>
            </div>

            <h1 className="mt-4 max-w-3xl text-[30px] font-semibold leading-tight tracking-tight sm:text-[40px] lg:text-[46px]">
              Marketplace assets that feel more curated, polished and ready for production.
            </h1>
            <p className="muted mt-4 max-w-2xl text-[14px] leading-relaxed sm:text-[15px]">
              Discover Roblox systems, Minecraft plugins, Discord bots and web templates in a
              storefront built for trust. Reviewed sellers, verified-purchase reviews and private
              file delivery keep the experience premium for both buyers and creators.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/browse" className="btn btn-primary h-10 px-4">
                Explore marketplace
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/account/seller" className="btn btn-secondary h-10 px-4">
                Start selling
              </Link>
            </div>

            <form action="/browse" className="mt-6 flex max-w-2xl gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                  aria-hidden
                />
                <input
                  type="search"
                  name="q"
                  placeholder="Search for plugins, scripts, bots, templates..."
                  aria-label="Search the marketplace"
                  className="input h-11 pl-9"
                />
              </div>
              <button type="submit" className="btn btn-primary h-11 px-4">
                Search
              </button>
            </form>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MetricCard value={totalPublished} label="Published products" />
              <MetricCard value={categories.length} label="Active categories" />
              <MetricCard value={showcaseProducts.length} label="Fresh highlights" />
            </div>

            {categories.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {categories.slice(0, 8).map((category: CategoryWithCount) => (
                  <Link
                    key={category.slug}
                    href={`/category/${category.slug}`}
                    className="badge transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {category.name}
                    <span className="subtle tabular-nums">{category._count.products}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <div className="surface premium-card soft-pulse overflow-hidden p-3">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] border border-line bg-elevated">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts */}
                <img
                  src={heroProduct?.thumbnailUrl || HERO_ILLUSTRATION}
                  alt={heroProduct?.title || "Marketplace preview"}
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0c]/90 via-[#0b0b0c]/20 to-transparent" />
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="badge badge-accent">Curated picks</span>
                  <span className="badge">Private delivery</span>
                </div>
                <div className="absolute inset-x-4 bottom-4">
                  <div className="surface-elevated max-w-sm p-3 backdrop-blur-sm">
                    <p className="text-[13px] font-medium text-ink">
                      {heroProduct?.title || "Marketplace collections for premium digital products"}
                    </p>
                    <p className="muted mt-1 text-[12px] leading-relaxed">
                      {heroProduct?.seller?.storeName
                        ? `Featured creator: ${heroProduct.seller.storeName}`
                        : "A cleaner storefront with richer product presentation and a stronger first impression."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <VisualNote
                  icon={<Boxes className="size-4" aria-hidden />}
                  title="More visual depth"
                  body="A stronger hero, clearer hierarchy and richer product framing."
                  className="drift"
                />
                <VisualNote
                  icon={<Zap className="size-4" aria-hidden />}
                  title="Subtle motion"
                  body="Gentle hover and ambient movement instead of loud effects."
                  className="drift-delayed"
                />
                <VisualNote
                  icon={<BadgeCheck className="size-4" aria-hidden />}
                  title="Still trustworthy"
                  body="The clean premium tone stays intact while the page feels more alive."
                />
              </div>
            </div>

            {supportingProducts.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:absolute xl:-bottom-8 xl:-left-10 xl:w-[420px]">
                {supportingProducts.slice(0, 2).map((product) => (
                  <MiniShowcaseCard key={product.slug} product={product} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <TrustCard
          icon={<BadgeCheck className="size-4" />}
          title="Reviewed sellers only"
          body="Seller applications are approved by platform staff. Sellers can never approve their own store or products."
        />
        <TrustCard
          icon={<ShieldCheck className="size-4" />}
          title="Verified-purchase reviews"
          body="A review can only be written against a paid order line, which keeps ratings honest."
        />
        <TrustCard
          icon={<Lock className="size-4" />}
          title="Private file delivery"
          body="Paid downloads are stored in a private bucket and issued as expiring links after an entitlement check."
        />
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <StoryPanel
          eyebrow="For buyers"
          title="Discover assets that look ready before you even open the product page."
          body="Stronger presentation, clearer metadata and a more editorial layout make the marketplace feel curated instead of crowded."
          image={BUYER_ILLUSTRATION}
          bullets={[
            "Cleaner discovery flow with richer previews",
            "Trust-first signals before checkout",
            "A softer, more premium browsing experience",
          ]}
        />
        <StoryPanel
          eyebrow="For sellers"
          title="Give creators a storefront that feels worth publishing into."
          body="Uploading files is only part of it. The whole surface should make good products feel more valuable the moment they appear."
          image={SELLER_ILLUSTRATION}
          bullets={[
            "Better visual framing for premium assets",
            "More polished call-to-actions and category entry points",
            "A stronger first impression for new releases",
          ]}
        />
      </section>

      <section className="surface hero-shell mt-8 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="badge">Marketplace experience</p>
            <h2 className="mt-3 text-[24px] font-semibold tracking-tight sm:text-[28px]">
              A cleaner flow from discovery to delivery.
            </h2>
            <p className="muted mt-3 text-[13.5px] leading-relaxed">
              The goal is not loud effects. It is confidence, rhythm and enough visual detail that
              the marketplace feels active even before the catalogue is full.
            </p>
          </div>
          <Link href="/browse" className="btn btn-secondary h-10 px-4">
            Browse all products
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="ambient-divider my-6" />

        <div className="grid gap-3 md:grid-cols-3">
          <JourneyCard
            step="01"
            title="Browse curated categories"
            body="Category cards and search entry points now feel more like a polished catalogue than a plain database."
          />
          <JourneyCard
            step="02"
            title="Evaluate with confidence"
            body="Verified-purchase reviews, reviewed sellers and clear metadata keep the page grounded in trust."
          />
          <JourneyCard
            step="03"
            title="Get files privately"
            body="After purchase, buyers receive secure delivery through expiring signed links tied to entitlement checks."
          />
        </div>
      </section>

      {isCatalogueEmpty ? (
        <div className="surface mt-6">
          <EmptyState
            icon={<Download className="size-5" />}
            title="The catalogue is empty"
            description="No products have been published yet. Nothing is shown here until real listings exist — the marketplace never fabricates sales figures, reviews or testimonials."
            action={
              <Link href="/account/seller" className="btn btn-secondary btn-sm">
                Apply to become a seller
              </Link>
            }
          />
        </div>
      ) : null}

      {featured.items.length > 0 ? (
        <Section title="Featured" href="/browse">
          <ProductGrid products={featured.items as ProductCardData[]} />
        </Section>
      ) : null}

      {newest.items.length > 0 ? (
        <Section title="Newest releases" href="/browse?sort=newest">
          <ProductGrid products={newest.items as ProductCardData[]} />
        </Section>
      ) : null}

      {hasSales ? (
        <Section title="Best selling" href="/browse?sort=best-selling">
          <ProductGrid products={bestSelling.items as ProductCardData[]} />
        </Section>
      ) : null}

      {categories.length > 0 ? (
        <Section title="Browse by category" href="/browse">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category: CategoryWithCount) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="surface premium-card flex items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium">{category.name}</p>
                  {category.description ? (
                    <p className="muted mt-1 line-clamp-2 text-[12px] leading-relaxed">
                      {category.description}
                    </p>
                  ) : null}
                </div>
                <span className="subtle shrink-0 text-[12px] tabular-nums">
                  {category._count.products}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <Link href={href} className="btn btn-ghost btn-sm">
          View all
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

function TrustCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="surface premium-card p-4">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-[13px] font-medium text-ink">{title}</p>
      </div>
      <p className="muted mt-1.5 text-[12px] leading-relaxed">{body}</p>
    </div>
  );
}

function MetricCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="surface-elevated premium-card px-4 py-3">
      <p className="text-[20px] font-semibold tracking-tight tabular-nums text-ink">
        {value}
      </p>
      <p className="muted mt-1 text-[12px]">{label}</p>
    </div>
  );
}

function VisualNote({
  icon,
  title,
  body,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={`surface-elevated premium-card p-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-[12.5px] font-medium text-ink">{title}</p>
      </div>
      <p className="muted mt-1.5 text-[11.5px] leading-relaxed">{body}</p>
    </div>
  );
}

function MiniShowcaseCard({ product }: { product: HeroProduct }) {
  return (
    <Link href={`/product/${product.slug}`} className="surface premium-card block overflow-hidden p-2">
      <div className="flex items-center gap-3">
        <div className="relative aspect-[2/1] w-28 shrink-0 overflow-hidden rounded-[8px] border border-line bg-elevated">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts */}
          <img
            src={product.thumbnailUrl || HERO_ILLUSTRATION}
            alt={product.title}
            className="size-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="subtle text-[10.5px] uppercase tracking-[0.08em]">
            {product.category?.name || "Featured asset"}
          </p>
          <p className="mt-1 line-clamp-2 text-[12.5px] font-medium text-ink">{product.title}</p>
          <p className="muted mt-1 text-[11.5px]">
            {product.seller?.storeName || "KDILGAMES creator"}
          </p>
        </div>
      </div>
    </Link>
  );
}

function StoryPanel({
  eyebrow,
  title,
  body,
  image,
  bullets,
}: {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  bullets: string[];
}) {
  return (
    <div className="surface premium-card overflow-hidden">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-line bg-elevated">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts */}
        <img src={image} alt={title} className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0c]/85 via-[#0b0b0c]/15 to-transparent" />
      </div>
      <div className="p-5">
        <p className="badge">{eyebrow}</p>
        <h3 className="mt-3 text-[18px] font-semibold tracking-tight">{title}</h3>
        <p className="muted mt-2 text-[13px] leading-relaxed">{body}</p>
        <div className="mt-4 space-y-2">
          {bullets.map((bullet) => (
            <div key={bullet} className="flex items-start gap-2">
              <span className="mt-[5px] size-1.5 rounded-full bg-accent" />
              <p className="muted text-[12.5px] leading-relaxed">{bullet}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JourneyCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-elevated premium-card p-4">
      <p className="subtle text-[11px] font-medium tracking-[0.14em]">{step}</p>
      <h3 className="mt-3 text-[14px] font-semibold text-ink">{title}</h3>
      <p className="muted mt-2 text-[12.5px] leading-relaxed">{body}</p>
    </div>
  );
}
