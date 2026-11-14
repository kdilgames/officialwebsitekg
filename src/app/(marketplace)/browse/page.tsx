import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, X } from "lucide-react";

import { ProductGrid } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import {
  browseProducts,
  categoryWithDescendants,
  listCategories,
  SORT_OPTIONS,
  type ProductSort,
} from "@/lib/queries/products";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Browse products" };

type SearchParams = {
  q?: string;
  category?: string;
  seller?: string;
  tag?: string;
  license?: string;
  min?: string;
  max?: string;
  sort?: string;
  page?: string;
};

const LICENSES = [
  { value: "", label: "Any license" },
  { value: "PERSONAL", label: "Personal" },
  { value: "STANDARD", label: "Standard" },
  { value: "EXTENDED", label: "Extended" },
  { value: "CUSTOM", label: "Custom" },
];

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const categorySlug = params.category?.trim();
  const resolved = categorySlug ? await categoryWithDescendants(categorySlug) : null;

  const sort = (SORT_OPTIONS.find((option) => option.value === params.sort)?.value ??
    "relevance") as ProductSort;

  const [result, categories] = await Promise.all([
    browseProducts({
      q: params.q,
      categoryIds: resolved?.ids,
      seller: params.seller,
      tag: params.tag,
      license: params.license,
      minPrice: toNumber(params.min),
      maxPrice: toNumber(params.max),
      sort,
      page: Number.parseInt(params.page ?? "1", 10) || 1,
    }),
    listCategories(),
  ]);

  const buildHref = (overrides: Partial<Record<keyof SearchParams, string | undefined>>) => {
    const query = new URLSearchParams();
    const merged: SearchParams = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue;
      if (key === "page" && value === "1") continue;
      if (key === "sort" && value === "relevance") continue;
      query.set(key, value);
    }
    const suffix = query.toString();
    return suffix ? `/browse?${suffix}` : "/browse";
  };

  const buildPageHref = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    if (page > 1) query.set("page", String(page));
    const suffix = query.toString();
    return suffix ? `/browse?${suffix}` : "/browse";
  };

  const activeCategory = resolved?.category;
  const topCategories = categories.filter((category) => !category.parentId);
  const hasFilters = Boolean(
    params.q ||
      categorySlug ||
      params.seller ||
      params.tag ||
      params.license ||
      params.min ||
      params.max,
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">
          {activeCategory ? activeCategory.name : "Browse catalogue"}
        </h1>
        <p className="muted mt-1.5 max-w-2xl text-[14px]">
          {activeCategory?.description ??
            "Find scripts, plugins, bots and templates by category, license type or price."}
        </p>

        {topCategories.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={buildHref({ category: undefined, page: undefined })}
              className={`badge transition-colors ${
                !categorySlug
                  ? "badge-accent"
                  : "hover:border-line-strong hover:bg-surface hover:text-ink"
              }`}
            >
              All categories
            </Link>
            {topCategories.map((category) => (
              <Link
                key={category.slug}
                href={buildHref({ category: category.slug, page: undefined })}
                className={`badge transition-colors ${
                  categorySlug === category.slug
                    ? "badge-accent"
                    : "hover:border-line-strong hover:bg-surface hover:text-ink"
                }`}
              >
                {category.name}
                <span className="opacity-70 tabular-nums">{category._count.products}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[268px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <form action="/browse" className="surface space-y-4 p-4">
            <Field label="Search" htmlFor="q">
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Keywords..." />
            </Field>

            <Field label="Category" htmlFor="category">
              <Select id="category" name="category" defaultValue={categorySlug ?? ""}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name} ({category._count.products})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="License" htmlFor="license">
              <Select id="license" name="license" defaultValue={params.license ?? ""}>
                {LICENSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Min price" htmlFor="min">
                <Input id="min" name="min" type="number" min={0} step="0.5" defaultValue={params.min} />
              </Field>
              <Field label="Max price" htmlFor="max">
                <Input id="max" name="max" type="number" min={0} step="0.5" defaultValue={params.max} />
              </Field>
            </div>

            <Field label="Sort by" htmlFor="sort">
              <Select id="sort" name="sort" defaultValue={sort}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" className="flex-1">
                Apply filters
              </Button>
              {hasFilters ? (
                <Link href="/browse" className="btn btn-secondary">
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="muted text-[13px] tabular-nums">
                {result.total} {result.total === 1 ? "product" : "products"}
                {params.q ? ` for “${params.q}”` : ""}
              </p>

              {params.q ? (
                <Link
                  href={buildHref({ q: undefined, page: undefined })}
                  className="badge hover:border-line-strong hover:text-ink"
                >
                  Search: {params.q}
                  <X className="size-3" aria-hidden />
                </Link>
              ) : null}
              {params.tag ? (
                <Link
                  href={buildHref({ tag: undefined, page: undefined })}
                  className="badge hover:border-line-strong hover:text-ink"
                >
                  Tag: {params.tag}
                  <X className="size-3" aria-hidden />
                </Link>
              ) : null}
              {params.license ? (
                <Link
                  href={buildHref({ license: undefined, page: undefined })}
                  className="badge hover:border-line-strong hover:text-ink"
                >
                  {params.license.toLowerCase()} license
                  <X className="size-3" aria-hidden />
                </Link>
              ) : null}
            </div>

            {result.totalPages > 1 ? (
              <p className="subtle text-[12.5px] tabular-nums">
                Page {result.page} of {result.totalPages}
              </p>
            ) : null}
          </div>

          {result.items.length === 0 ? (
            <div className="surface">
              <EmptyState
                icon={<SearchX className="size-5" />}
                title="No products match these filters"
                description="Try widening the price range, clearing the search term, or switching to another category."
                action={
                  <Link href="/browse" className="btn btn-secondary btn-sm">
                    Clear all filters
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                buildHref={buildPageHref}
                className="mt-6"
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
