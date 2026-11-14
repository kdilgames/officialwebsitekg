import Link from "next/link";
import { BadgeCheck, Layers, Package } from "lucide-react";

import { formatMoney } from "@/lib/money";

export type BundleCardData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  bundlePriceMinor: number;
  currency: string;
  seller: { slug: string; storeName: string };
  items: Array<{
    product: {
      id: string;
      title: string;
      slug: string;
      thumbnailUrl: string | null;
      priceMinor: number;
      salePriceMinor: number | null;
      currency: string;
    };
  }>;
};

export function BundleCard({ bundle }: { bundle: BundleCardData }) {
  const regularTotalMinor = bundle.items.reduce(
    (sum, item) => sum + (item.product.salePriceMinor ?? item.product.priceMinor),
    0,
  );
  const savingsPercent =
    regularTotalMinor > bundle.bundlePriceMinor && regularTotalMinor > 0
      ? Math.round(((regularTotalMinor - bundle.bundlePriceMinor) / regularTotalMinor) * 100)
      : 0;

  return (
    <Link
      href={`/bundle/${bundle.slug}`}
      className="surface card-interactive group flex flex-col justify-between overflow-hidden p-4 sm:p-5"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="badge badge-accent">
            <Layers className="size-3" aria-hidden />
            {bundle.items.length} products bundled
          </span>
          {savingsPercent > 0 ? (
            <span className="badge badge-positive tabular-nums">Save {savingsPercent}%</span>
          ) : null}
        </div>

        <h3 className="mt-3 line-clamp-2 text-[15.5px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
          {bundle.title}
        </h3>

        <p className="muted mt-1 flex items-center gap-1 text-[12.5px]">
          <span className="truncate">by {bundle.seller.storeName}</span>
          <BadgeCheck className="size-3.5 shrink-0 text-accent" aria-hidden />
        </p>

        {bundle.description ? (
          <p className="muted mt-2 line-clamp-2 text-[12.5px] leading-relaxed">
            {bundle.description}
          </p>
        ) : null}

        <ul className="mt-3 space-y-1.5 rounded-[8px] border border-line/70 bg-elevated/50 p-2.5">
          {bundle.items.slice(0, 4).map(({ product }) => (
            <li key={product.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5 text-ink-muted">
                <Package className="size-3 shrink-0 text-ink-subtle" aria-hidden />
                <span className="truncate">{product.title}</span>
              </span>
              <span className="subtle shrink-0 tabular-nums">
                {formatMoney(product.salePriceMinor ?? product.priceMinor, product.currency)}
              </span>
            </li>
          ))}
          {bundle.items.length > 4 ? (
            <li className="subtle pl-4 text-[11px]">
              +{bundle.items.length - 4} more included
            </li>
          ) : null}
        </ul>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-line/70 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[16px] font-semibold tabular-nums text-ink">
            {formatMoney(bundle.bundlePriceMinor, bundle.currency)}
          </span>
          {regularTotalMinor > bundle.bundlePriceMinor ? (
            <span className="subtle text-[12px] line-through tabular-nums">
              {formatMoney(regularTotalMinor, bundle.currency)}
            </span>
          ) : null}
        </div>
        <span className="text-[12px] font-medium text-accent">View bundle</span>
      </div>
    </Link>
  );
}
