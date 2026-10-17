import Link from "next/link";
import { PlusCircle, Package } from "lucide-react";

import { EmptyState } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { listSellerProducts } from "@/lib/seller/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products · Seller dashboard" };

export default async function DashboardProductsPage() {
  const user = await requireSeller();
  const products = await listSellerProducts(user.sellerProfile.id);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Products</h1>
          <p className="muted mt-1 text-[12.5px]">
            {products.length} listing{products.length === 1 ? "" : "s"} in your store. New and edited
            listings go through platform review before they appear in the marketplace.
          </p>
        </div>
        <Link href="/dashboard/products/new" className={buttonClass("primary", "sm")}>
          <PlusCircle className="size-3.5" aria-hidden />
          New product
        </Link>
      </header>

      <Card>
        <CardHeader title="All listings" description="Ordered by the last time you edited them." />

        {products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Create a listing, attach the files buyers receive, then submit it for review."
            icon={<Package className="size-5" aria-hidden />}
            action={
              <Link href="/dashboard/products/new" className={buttonClass("primary", "sm")}>
                Create your first product
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th className="text-right">Sales</th>
                  <th className="text-right">Views</th>
                  <th className="text-right">Rating</th>
                  <th>Assets</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product: any) => {
                  const rating =
                    product.ratingCount > 0 ? product.ratingSum / product.ratingCount : null;
                  return (
                    <tr key={product.id}>
                      <td className="max-w-[280px]">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="block truncate font-medium hover:text-accent"
                        >
                          {product.title}
                        </Link>
                        <span className="subtle text-[11.5px]">
                          {product.category.name} · updated{" "}
                          {product.updatedAt.toISOString().slice(0, 10)}
                        </span>
                        {product.status === "REJECTED" && product.rejectionReason ? (
                          <span className="mt-0.5 block text-[11.5px] text-critical">
                            {product.rejectionReason}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <StatusBadge status={product.status} />
                      </td>
                      <td className="whitespace-nowrap tabular-nums">
                        {product.salePriceMinor ? (
                          <>
                            <span className="text-accent">
                              {formatMoney(product.salePriceMinor, product.currency)}
                            </span>
                            <span className="subtle ml-1.5 line-through">
                              {formatMoney(product.priceMinor, product.currency)}
                            </span>
                          </>
                        ) : (
                          formatMoney(product.priceMinor, product.currency)
                        )}
                      </td>
                      <td className="text-right tabular-nums">{product.salesCount}</td>
                      <td className="text-right tabular-nums">{product.viewCount}</td>
                      <td className="text-right tabular-nums">
                        {rating === null ? <span className="subtle">—</span> : rating.toFixed(1)}
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-ink-muted">
                        {product._count.files} file{product._count.files === 1 ? "" : "s"} ·{" "}
                        {product._count.images} image{product._count.images === 1 ? "" : "s"}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className={buttonClass("secondary", "sm")}
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
