import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductGrid } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/table";
import { browseProducts, categoryWithDescendants, listCategories } from "@/lib/queries/products";
import Link from "next/link";

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

  const sort = (query.sort ?? "relevance") as "relevance" | "newest" | "best-selling";
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

  const children = categories.filter((entry: any) => entry.parentId === category.id);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-7">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">{category.name}</h1>
        {category.description ? (
          <p className="muted mt-1 max-w-3xl text-[13px] leading-relaxed">
            {category.description}
          </p>
        ) : null}
      </header>

      {children.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {children.map((child: any) => (
            <Link key={child.slug} href={`/category/${child.slug}`} className="badge hover:text-ink">
              {child.name}
              <span className="subtle tabular-nums">{child._count.products}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {result.items.length === 0 ? (
        <div className="surface">
          <EmptyState
            title="Nothing published in this category yet"
            description="Listings appear here as soon as a seller publishes an approved product."
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
            className="mt-5"
          />
        </>
      )}
    </div>
  );
}
