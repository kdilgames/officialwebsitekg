import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, PackageOpen } from "lucide-react";

import { getCategoryVisual } from "@/components/marketplace/category-visuals";
import { ProductGrid } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/table";
import {
  browseProducts,
  categoryWithDescendants,
  listCategories,
  SORT_OPTIONS,
  type ProductSort,
} from "@/lib/queries/products";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string; min?: string; max?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await categoryWithDescendants(slug);
  return { title: category ? category.name : "Category not found" };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { category, ids } = await categoryWithDescendants(slug);
  if (!category) notFound();

  const sort = (SORT_OPTIONS.find((option) => option.value === query.sort)?.value ??
    "relevance") as ProductSort;
  const page = Number.parseInt(query.page ?? "1", 10) || 1;

  const [result, categories] = await Promise.all([
    browseProducts({
      categoryIds: ids,
      sort,
      page,
      minPrice: query.min ? Number.parseFloat(query.min) : undefined,
      maxPrice: query.max ? Number.parseFloat(query.max) : undefined,
    }),
    listCategories(),
  ]);

  const children = categories.filter((entry) => entry.parentId === category.id);
  const visual = getCategoryVisual(category.slug);
  const CategoryIcon = visual.icon;

  const buildSortHref = (nextSort: ProductSort) => {
    const search = new URLSearchParams();
    if (nextSort !== "relevance") search.set("sort", nextSort);
    if (query.min) search.set("min", query.min);
    if (query.max) search.set("max", query.max);
    const suffix = search.toString();
    return suffix ? `/category/${slug}?${suffix}` : `/category/${slug}`;
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <nav className="subtle mb-4 flex items-center gap-1.5 text-[12.5px]" aria-label="Breadcrumb">
        <Link href="/browse" className="hover:text-ink">
          Browse
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-medium text-ink-muted">{category.name}</span>
      </nav>

      <header className="surface mb-6 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span
            className={`flex size-12 shrink-0 items-center justify-center rounded-[12px] border ${visual.chipClass}`}
          >
            <CategoryIcon className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-ink">{category.name}</h1>
            {category.description ? (
              <p className="muted mt-1 max-w-2xl text-[13.5px] leading-relaxed">
                {category.description}
              </p>
            ) : null}
          </div>
        </div>

        <span className="badge tabular-nums">
          {result.total} {result.total === 1 ? "listing" : "listings"}
        </span>
      </header>

      {children.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {children.map((child) => (
            <Link
              key={child.slug}
              href={`/category/${child.slug}`}
              className="badge hover:border-line-strong hover:bg-surface hover:text-ink"
            >
              {child.name}
              <span className="subtle tabular-nums">{child._count.products}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="subtle mr-1 text-[12.5px]">Sort:</span>
          {SORT_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildSortHref(option.value)}
              className={`badge transition-colors ${
                sort === option.value
                  ? "badge-accent"
                  : "hover:border-line-strong hover:bg-surface hover:text-ink"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<PackageOpen className="size-5" aria-hidden />}
            title="No listings in this category yet"
            description="Approved creator products in this category will appear here as soon as they are published."
            action={
              <Link href="/browse" className="btn btn-secondary btn-sm">
                Browse all categories
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
            buildHref={(next) => {
              const search = new URLSearchParams();
              if (query.sort) search.set("sort", query.sort);
              if (query.min) search.set("min", query.min);
              if (query.max) search.set("max", query.max);
              if (next > 1) search.set("page", String(next));
              const suffix = search.toString();
              return suffix ? `/category/${slug}?${suffix}` : `/category/${slug}`;
            }}
            className="mt-6"
          />
        </>
      )}
    </div>
  );
}
