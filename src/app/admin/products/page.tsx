import Link from "next/link";
import { Package } from "lucide-react";

import { ActionButton, ReasonForm } from "@/components/admin/action-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import {
  approveProductAction,
  rejectProductAction,
  suspendProductAction,
  toggleFeaturedProductAction,
} from "@/lib/admin/actions";
import { listProductsForModeration } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products · Admin" };

const STATUS_OPTIONS = [
  { value: "PENDING_REVIEW", label: "In review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "ALL", label: "All" },
];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "PENDING_REVIEW";
  const q = params.q?.trim() ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listProductsForModeration({ status, q, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "PENDING_REVIEW") query.set("status", status);
    if (q) query.set("q", q);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/products?${suffix}` : "/admin/products";
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Product moderation</h1>
        <p className="muted mt-1 text-[12.5px]">
          Sellers submit listings; publication is a staff decision. A listing with no active delivery
          file cannot be approved.
        </p>
      </header>

      <form action="/admin/products" className="surface flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[200px] flex-1">
          <label className="label mb-1.5" htmlFor="q">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Title, slug or store name" />
        </div>
        <div className="w-[170px]">
          <label className="label mb-1.5" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm">
          Apply
        </button>
        <Link href="/admin/products" className="btn btn-secondary btn-sm">
          Reset
        </Link>
      </form>

      <Card>
        <CardHeader
          title={`${result.total} listing${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="No listings match"
            description="Try another status or clear the search term."
            icon={<Package className="size-5" aria-hidden />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th className="text-right">Sales</th>
                  <th>Delivery</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((product) => {
                  const price =
                    product.salePriceMinor !== null
                      ? formatMoney(product.salePriceMinor, product.currency)
                      : formatMoney(product.priceMinor, product.currency);
                  const hasFiles = product._count.files > 0;

                  return (
                    <tr key={product.id}>
                      <td className="max-w-[280px]">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="block truncate font-medium hover:text-accent"
                        >
                          {product.title}
                        </Link>
                        <span className="subtle text-[11.5px]">
                          {product.category.name}
                          {product.isFeatured ? " · featured" : ""} ·{" "}
                          {product.submittedAt
                            ? `submitted ${product.submittedAt.toISOString().slice(0, 10)}`
                            : `created ${product.createdAt.toISOString().slice(0, 10)}`}
                        </span>
                        {product.status === "REJECTED" && product.rejectionReason ? (
                          <span className="mt-0.5 block text-[11.5px] text-critical">
                            {product.rejectionReason}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap text-[12.5px]">
                        <Link
                          href={`/seller/${product.seller.slug}`}
                          className="hover:text-accent"
                        >
                          {product.seller.storeName}
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={product.status} />
                      </td>
                      <td className="whitespace-nowrap tabular-nums">{price}</td>
                      <td className="text-right tabular-nums">{product.salesCount}</td>
                      <td className="whitespace-nowrap text-[12px] text-ink-muted">
                        {hasFiles ? (
                          <>
                            {product._count.files} file{product._count.files === 1 ? "" : "s"} ·{" "}
                            {product._count.images} image{product._count.images === 1 ? "" : "s"}
                          </>
                        ) : (
                          <Badge tone="critical">no files</Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-start justify-end gap-1.5">
                          {product.status === "PENDING_REVIEW" && hasFiles ? (
                            <ActionButton
                              action={approveProductAction}
                              fields={{ productId: product.id }}
                              variant="primary"
                              confirm="Publish this listing to the storefront?"
                            >
                              Approve
                            </ActionButton>
                          ) : null}

                          {product.status === "PENDING_REVIEW" ? (
                            <ReasonForm
                              action={rejectProductAction}
                              fields={{ productId: product.id }}
                              label="Reject"
                              submitLabel="Reject listing"
                              placeholder="What must the seller change? At least a sentence."
                              confirm="Reject this listing?"
                            />
                          ) : null}

                          {product.status === "PUBLISHED" || product.status === "PENDING_REVIEW" ? (
                            <ReasonForm
                              action={suspendProductAction}
                              fields={{ productId: product.id }}
                              label="Remove"
                              submitLabel="Remove listing"
                              placeholder="Why is this listing being taken down?"
                              confirm="Remove this listing from the storefront?"
                            />
                          ) : null}

                          {product.status === "PUBLISHED" ? (
                            <ActionButton
                              action={toggleFeaturedProductAction}
                              fields={{ productId: product.id }}
                            >
                              {product.isFeatured ? "Unfeature" : "Feature"}
                            </ActionButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </div>
  );
}
