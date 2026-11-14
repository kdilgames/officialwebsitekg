import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";

import { getCategoryVisual } from "@/components/marketplace/category-visuals";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export type ProductCardData = {
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  priceMinor: number;
  salePriceMinor: number | null;
  currency: string;
  ratingSum: number;
  ratingCount: number;
  salesCount: number;
  category: { name: string; slug: string };
  seller: { slug: string; storeName: string };
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const price = product.salePriceMinor ?? product.priceMinor;
  const onSale = product.salePriceMinor !== null && product.salePriceMinor < product.priceMinor;
  const discountPercent =
    onSale && product.priceMinor > 0
      ? Math.round(((product.priceMinor - price) / product.priceMinor) * 100)
      : 0;

  const visual = getCategoryVisual(product.category.slug);
  const CategoryIcon = visual.icon;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="surface card-interactive group flex flex-col overflow-hidden"
    >
      <div className={`relative aspect-[2/1] overflow-hidden border-b border-line ${visual.canvasClass}`}>
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- hosts are configured in next.config.ts
          <img
            src={product.thumbnailUrl}
            alt={product.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center">
            <span
              className={`flex size-10 items-center justify-center rounded-[10px] border ${visual.chipClass}`}
            >
              <CategoryIcon className="size-5" aria-hidden />
            </span>
            <span className="subtle text-[11px] font-medium">{product.category.name}</span>
          </div>
        )}
        {onSale ? (
          <span className="badge badge-accent absolute left-2.5 top-2.5 shadow-xs">
            {discountPercent > 0 ? `-${discountPercent}%` : "Sale"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="subtle text-[11px] font-medium uppercase tracking-[0.05em]">
          {product.category.name}
        </p>
        <h3 className="mt-1 line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
          {product.title}
        </h3>

        <p className="muted mb-4 mt-1.5 flex items-center gap-1 truncate text-[12.5px]">
          <span className="truncate">by {product.seller.storeName}</span>
          <BadgeCheck className="size-3.5 shrink-0 text-accent" aria-hidden />
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 pt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tabular-nums text-ink">
              {formatMoney(price, product.currency)}
            </span>
            {onSale ? (
              <span className="subtle text-[12px] line-through tabular-nums">
                {formatMoney(product.priceMinor, product.currency)}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {product.ratingCount > 0 ? (
              <span
                className="flex items-center gap-1 text-[12px] font-medium text-ink-muted"
                title={`${product.ratingCount} verified reviews`}
              >
                <Star className="size-3.5 fill-caution text-caution" aria-hidden />
                <span className="tabular-nums text-ink">
                  {(product.ratingSum / product.ratingCount).toFixed(1)}
                </span>
                <span className="subtle tabular-nums">({product.ratingCount})</span>
              </span>
            ) : product.salesCount > 0 ? (
              <span className="subtle text-[11.5px] tabular-nums">
                {product.salesCount} {product.salesCount === 1 ? "sale" : "sales"}
              </span>
            ) : (
              <Badge>New</Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}
