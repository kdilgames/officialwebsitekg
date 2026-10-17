import Link from "next/link";
import { ImageIcon, Star } from "lucide-react";

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

  return (
    <Link
      href={`/product/${product.slug}`}
      className="surface premium-card group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-[2/1] overflow-hidden border-b border-line bg-elevated">
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- hosts are configured in next.config.ts
          <img
            src={product.thumbnailUrl}
            alt={product.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-subtle">
            <ImageIcon className="size-6" aria-hidden />
          </div>
        )}
        {onSale ? (
          <span className="badge badge-accent absolute left-2 top-2">Sale</span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="subtle text-[11px] uppercase tracking-[0.04em]">{product.category.name}</p>
        <h3 className="mt-1 line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">
          {product.title}
        </h3>

        <p className="muted mt-1 truncate text-[12px]">by {product.seller.storeName}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-semibold tabular-nums">
              {formatMoney(price, product.currency)}
            </span>
            {onSale ? (
              <span className="subtle text-[11.5px] line-through tabular-nums">
                {formatMoney(product.priceMinor, product.currency)}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {product.ratingCount > 0 ? (
              <span
                className="flex items-center gap-1 text-[11.5px] text-ink-muted"
                title={`${product.ratingCount} verified reviews`}
              >
                <Star className="size-3 text-caution" aria-hidden />
                <span className="tabular-nums">
                  {(product.ratingSum / product.ratingCount).toFixed(1)}
                </span>
              </span>
            ) : (
              <Badge>New</Badge>
            )}
          </div>
        </div>

        {product.salesCount > 0 ? (
          <p className="subtle mt-1.5 text-[11px] tabular-nums">
            {product.salesCount} {product.salesCount === 1 ? "sale" : "sales"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}
