import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  ImageIcon,
  Layers,
  ShieldCheck,
} from "lucide-react";

import { AddBundleToCartButton } from "@/components/marketplace/cart-actions";
import { getCategoryVisual } from "@/components/marketplace/category-visuals";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { addBundleToCartAction } from "@/lib/marketplace/actions";
import { formatMoney } from "@/lib/money";
import { getPublishedBundleBySlug } from "@/lib/queries/products";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getPublishedBundleBySlug(slug);
  if (!bundle) return { title: "Bundle not found" };
  return {
    title: `${bundle.title} — Bundle`,
    description: bundle.description ?? `${bundle.items.length} digital products bundled by ${bundle.seller.storeName}.`,
  };
}

export default async function BundlePage({ params }: PageProps) {
  const { slug } = await params;
  const bundle = await getPublishedBundleBySlug(slug);
  if (!bundle) notFound();

  const user = await getSessionUser();
  const productIds = bundle.items.map(({ product }) => product.id);
  const ownedRows = user
    ? await prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: { buyerId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
        },
        select: { productId: true },
      })
    : [];
  const ownedSet = new Set(ownedRows.map((row) => row.productId));
  const ownsAll = productIds.every((id) => ownedSet.has(id));
  const isOwnStore = user?.id === bundle.seller.userId;

  const regularTotalMinor = bundle.items.reduce(
    (sum, { product }) => sum + (product.salePriceMinor ?? product.priceMinor),
    0,
  );
  const savingsMinor = Math.max(0, regularTotalMinor - bundle.bundlePriceMinor);
  const savingsPercent =
    regularTotalMinor > 0 ? Math.round((savingsMinor / regularTotalMinor) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <nav className="subtle mb-5 flex items-center gap-1.5 text-[12.5px]" aria-label="Breadcrumb">
        <Link href="/browse" className="hover:text-ink">
          Browse
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href={`/seller/${bundle.seller.slug}`} className="hover:text-ink">
          {bundle.seller.storeName}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate font-medium text-ink-muted">{bundle.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-3 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">
                  <Layers className="size-3" aria-hidden />
                  Creator bundle · {bundle.items.length} products
                </Badge>
                {savingsPercent > 0 ? (
                  <Badge tone="positive">Save {savingsPercent}%</Badge>
                ) : null}
              </div>

              <h1 className="text-[26px] font-bold tracking-tight text-ink">{bundle.title}</h1>

              {bundle.description ? (
                <p className="muted whitespace-pre-wrap text-[14px] leading-relaxed">
                  {bundle.description}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`Included products (${bundle.items.length})`}
              description="Every product unlocks individually in Orders & downloads along with future version updates."
            />
            <ul className="divide-y divide-line">
              {bundle.items.map(({ product }) => {
                const unitPrice = product.salePriceMinor ?? product.priceMinor;
                const visual = getCategoryVisual(product.category.slug);
                const owned = ownedSet.has(product.id);

                return (
                  <li key={product.id} className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                    <Link
                      href={`/product/${product.slug}`}
                      className={`flex aspect-[2/1] w-28 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-line ${visual.canvasClass}`}
                    >
                      {product.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote hosts are declared in next.config.ts
                        <img
                          src={product.thumbnailUrl}
                          alt={product.title}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="size-5 text-ink-subtle" aria-hidden />
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="subtle text-[11px] font-medium uppercase tracking-[0.05em]">
                          {product.category.name}
                        </span>
                        <Badge>v{product.version}</Badge>
                        {owned ? (
                          <Badge tone="positive">
                            <CheckCircle2 className="size-3" aria-hidden />
                            In your library
                          </Badge>
                        ) : null}
                      </div>

                      <Link
                        href={`/product/${product.slug}`}
                        className="mt-1 block truncate text-[15px] font-semibold text-ink hover:text-accent"
                      >
                        {product.title}
                      </Link>
                      <p className="muted mt-0.5 line-clamp-2 text-[12.5px]">
                        {product.shortDescription}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[13.5px] font-semibold tabular-nums text-ink">
                        {unitPrice === 0 ? "Free" : formatMoney(unitPrice, product.currency)}
                      </p>
                      <p className="subtle text-[11px]">Individual price</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody className="space-y-4 p-5">
              <div>
                <p className="subtle text-[11.5px] font-semibold uppercase tracking-[0.05em]">
                  Bundle offer
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-2.5 border-b border-line pb-4">
                  <span className="text-[28px] font-bold tracking-tight tabular-nums text-ink">
                    {formatMoney(bundle.bundlePriceMinor, bundle.currency)}
                  </span>
                  {regularTotalMinor > bundle.bundlePriceMinor ? (
                    <span className="subtle text-[14px] line-through tabular-nums">
                      {formatMoney(regularTotalMinor, bundle.currency)}
                    </span>
                  ) : null}
                </div>
              </div>

              {savingsMinor > 0 ? (
                <p className="text-[13px] font-medium text-positive">
                  You save {formatMoney(savingsMinor, bundle.currency)} compared to buying individually.
                </p>
              ) : null}

              {isOwnStore ? (
                <Alert tone="info">This bundle belongs to your store.</Alert>
              ) : ownsAll ? (
                <Link href="/account/orders" className="btn btn-secondary w-full">
                  You already own all items — view downloads
                </Link>
              ) : (
                <AddBundleToCartButton
                  action={addBundleToCartAction}
                  bundleId={bundle.id}
                  next="/cart"
                />
              )}

              <ul className="space-y-2 border-t border-line pt-3 text-[12.5px] text-ink-muted">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0 text-positive" aria-hidden />
                  Checkout processed securely via Stripe
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden />
                  Instant download access for all included items
                </li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Creator" />
            <CardBody className="p-5">
              <Link href={`/seller/${bundle.seller.slug}`} className="group flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-elevated text-[14px] font-semibold text-ink">
                  {bundle.seller.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                    <img src={bundle.seller.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    bundle.seller.storeName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink group-hover:text-accent">
                    {bundle.seller.storeName}
                    <BadgeCheck className="size-4 text-accent" aria-hidden />
                  </span>
                  {bundle.seller.tagline ? (
                    <span className="subtle block truncate text-[12px]">{bundle.seller.tagline}</span>
                  ) : null}
                </span>
              </Link>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
