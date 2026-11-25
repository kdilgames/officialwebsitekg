import Link from "next/link";
import { ExternalLink, Layers, Package } from "lucide-react";

import { ActionButton } from "@/components/admin/action-forms";
import { BundleCreatorForm } from "@/components/forms/promo-forms";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import {
  createSellerBundleAction,
  deleteSellerBundleAction,
  toggleSellerBundleAction,
} from "@/lib/seller/actions";
import {
  listSellerBundles,
  listSellerPublishedProductsForBundles,
} from "@/lib/seller/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bundles · Seller dashboard" };

export default async function SellerBundlesPage() {
  const user = await requireSeller();
  const seller = user.sellerProfile;

  const [bundles, publishedProducts] = await Promise.all([
    listSellerBundles(seller.id),
    listSellerPublishedProductsForBundles(seller.id),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Product bundles</h1>
        <p className="muted mt-1 text-[12.5px]">
          Package 2 to 6 of your published products at a discounted combined price. Buyers receive
          instant download access to every bundled item.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Create a bundle"
          description="Bundle pricing must be lower than buying the included products separately."
        />
        <CardBody>
          {publishedProducts.length < 2 ? (
            <Alert tone="info" title="Publish at least 2 products first">
              You currently have {publishedProducts.length} published{" "}
              {publishedProducts.length === 1 ? "product" : "products"}. Once at least 2 listings
              are approved and published, you can combine them into a bundle here.
            </Alert>
          ) : (
            <BundleCreatorForm action={createSellerBundleAction} products={publishedProducts} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${bundles.length} bundle${bundles.length === 1 ? "" : "s"}`}
          description="Active bundles appear on the storefront, home showcase, and your creator page."
        />
        {bundles.length === 0 ? (
          <EmptyState
            icon={<Layers className="size-5" aria-hidden />}
            title="No bundles yet"
            description="Create a starter pack or full suite above to lift average order value."
          />
        ) : (
          <ul className="divide-y divide-line">
            {bundles.map((bundle) => {
              const regularSum = bundle.items.reduce(
                (sum, item) => sum + (item.product.salePriceMinor ?? item.product.priceMinor),
                0,
              );
              const savingsPercent =
                regularSum > bundle.bundlePriceMinor && regularSum > 0
                  ? Math.round(((regularSum - bundle.bundlePriceMinor) / regularSum) * 100)
                  : 0;

              return (
                <li key={bundle.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">{bundle.title}</span>
                        <Badge tone={bundle.isActive ? "positive" : "caution"}>
                          {bundle.isActive ? "active" : "paused"}
                        </Badge>
                        {savingsPercent > 0 ? (
                          <Badge tone="accent">Save {savingsPercent}%</Badge>
                        ) : null}
                      </div>
                      <p className="subtle mt-0.5 text-[12px]">
                        /bundle/{bundle.slug} · {formatMoney(bundle.bundlePriceMinor, bundle.currency)}{" "}
                        (regular {formatMoney(regularSum, bundle.currency)})
                      </p>
                      {bundle.description ? (
                        <p className="muted mt-1 text-[12.5px]">{bundle.description}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {bundle.isActive ? (
                        <Link
                          href={`/bundle/${bundle.slug}`}
                          className="btn btn-secondary btn-sm"
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                          View
                        </Link>
                      ) : null}
                      <ActionButton
                        action={toggleSellerBundleAction}
                        fields={{ bundleId: bundle.id }}
                        variant="secondary"
                      >
                        {bundle.isActive ? "Pause" : "Activate"}
                      </ActionButton>
                      <ActionButton
                        action={deleteSellerBundleAction}
                        fields={{ bundleId: bundle.id }}
                        variant="danger"
                        confirm={`Delete bundle “${bundle.title}”? Existing orders stay intact.`}
                      >
                        Delete
                      </ActionButton>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {bundle.items.map(({ product }) => (
                      <Link
                        key={product.id}
                        href={`/dashboard/products/${product.id}`}
                        className="badge hover:border-line-strong hover:text-ink"
                      >
                        <Package className="size-3" aria-hidden />
                        {product.title}
                      </Link>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
