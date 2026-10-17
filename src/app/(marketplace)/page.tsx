import Link from "next/link";
import { ArrowRight, BadgeCheck, Download, Lock, Search, ShieldCheck } from "lucide-react";

import { ProductGrid } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/alert";
import { browseProducts, listCategories } from "@/lib/queries/products";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, newest, categories, bestSelling] = await Promise.all([
    browseProducts({ featuredOnly: true, sort: "newest", perPage: 8 }),
    browseProducts({ sort: "newest", perPage: 8 }),
    listCategories(),
    browseProducts({ sort: "best-selling", perPage: 8 }),
  ]);

  const hasSales = bestSelling.items.some((product) => product.salesCount > 0);
  const totalPublished = await prisma.product.count({ where: { status: "PUBLISHED" } });
  const isCatalogueEmpty = totalPublished === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <section className="surface px-5 py-8 sm:px-8 sm:py-10">
        <p className="badge badge-accent">Digital products for game developers</p>
        <h1 className="mt-3 max-w-3xl text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]">
          Buy and sell Roblox systems, Minecraft plugins, Discord bots and web templates.
        </h1>
        <p className="muted mt-3 max-w-2xl text-[13.5px] leading-relaxed">
          Every seller is reviewed before publishing, every review comes from a verified purchase,
          and paid files are delivered through short-lived signed links that only the buyer can use.
        </p>

        <form action="/browse" className="mt-6 flex max-w-2xl gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              placeholder="Search for plugins, scripts, bots, templates…"
              aria-label="Search the marketplace"
              className="input h-10 pl-9"
            />
          </div>
          <button type="submit" className="btn btn-primary h-10">
            Search
          </button>
        </form>

        {categories.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {categories.slice(0, 10).map((category) => (
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
          <ProductGrid products={featured.items} />
        </Section>
      ) : null}

      {newest.items.length > 0 ? (
        <Section title="Newest releases" href="/browse?sort=newest">
          <ProductGrid products={newest.items} />
        </Section>
      ) : null}

      {hasSales ? (
        <Section title="Best selling" href="/browse?sort=best-selling">
          <ProductGrid products={bestSelling.items} />
        </Section>
      ) : null}

      {categories.length > 0 ? (
        <Section title="Browse by category" href="/browse">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="surface flex items-start justify-between gap-3 p-4 transition-colors hover:border-line-strong"
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
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-[13px] font-medium text-ink">{title}</p>
      </div>
      <p className="muted mt-1.5 text-[12px] leading-relaxed">{body}</p>
    </div>
  );
}
