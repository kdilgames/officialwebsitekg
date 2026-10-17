import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";

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

  const result = await browseProducts({
    q: params.q,
    categoryIds: resolved?.ids,
    seller: params.seller,
    tag: params.tag,
    license: params.license,
    minPrice: toNumber(params.min),
    maxPrice: toNumber(params.max),
    sort,
    page: Number.parseInt(params.page ?? "1", 10) || 1,
  });

  const categories = await listCategories();

  const buildHref = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    if (page > 1) query.set("page", String(page));
    const suffix = query.toString();
    return suffix ? `/browse?${suffix}` : "/browse";
  };

  const activeCategory = resolved?.category;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-7">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">
          {activeCategory ? activeCategory.name : "Browse products"}
        </h1>
        <p className="muted mt-1 text-[13px]">
          {activeCategory?.description ??
            "Filter by category, price and license. Results only ever come from published listings."}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <form action="/browse" className="surface space-y-4 p-4">
            <Field label="Search" htmlFor="q">
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Keywords" />
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

            <div className="grid grid-cols-2 gap-2">
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

            <div className="flex gap-2">
              <Button type="submit" variant="primary" className="flex-1">
                Apply filters
              </Button>
              <Link href="/browse" className="btn btn-secondary">
                Reset
              </Link>
            </div>
          </form>
        </aside>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="muted text-[12.5px] tabular-nums">
              {result.total} {result.total === 1 ? "product" : "products"}
              {params.q ? ` for “${params.q}”` : ""}
            </p>
            {result.totalPages > 1 ? (
              <p className="subtle text-[12px] tabular-nums">
                Page {result.page} of {result.totalPages}
              </p>
            ) : null}
          </div>

          {result.items.length === 0 ? (
            <div className="surface">
              <EmptyState
                icon={<SearchX className="size-5" />}
                title="No products match these filters"
                description="Try widening the price range, clearing the search term, or browsing another category."
                action={
                  <Link href="/browse" className="btn btn-secondary btn-sm">
                    Clear filters
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
                buildHref={buildHref}
                className="mt-5"
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
