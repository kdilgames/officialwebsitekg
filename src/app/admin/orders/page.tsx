import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { EmptyState } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import { listOrders } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders · Admin" };

const STATUS_OPTIONS = [
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "PARTIALLY_REFUNDED", label: "Partially refunded" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "CANCELED", label: "Canceled" },
  { value: "ALL", label: "All" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "ALL";
  const q = params.q?.trim() ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listOrders({ status, q, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "ALL") query.set("status", status);
    if (q) query.set("q", q);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/orders?${suffix}` : "/admin/orders";
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Orders</h1>
        <p className="muted mt-1 text-[12.5px]">
          Order totals, the commission the platform kept and the amount credited to sellers. These
          are the figures recorded when the payment settled.
        </p>
      </header>

      <form action="/admin/orders" className="surface flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <label className="label mb-1.5" htmlFor="q">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Order number, username or email" />
        </div>
        <div className="w-[190px]">
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
        <Link href="/admin/orders" className="btn btn-secondary btn-sm">
          Reset
        </Link>
      </form>

      <Card>
        <CardHeader
          title={`${result.total} order${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="No orders match"
            description="Try another status or clear the search term."
            icon={<ShoppingBag className="size-5" aria-hidden />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Commission</th>
                  <th className="text-right">Seller net</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((order) => (
                  <tr key={order.id}>
                    <td className="max-w-[260px]">
                      <span className="block font-mono text-[12px] font-medium">
                        {order.orderNumber}
                      </span>
                      <span className="subtle text-[11.5px]">
                        {order._count.items} item{order._count.items === 1 ? "" : "s"} ·{" "}
                        {(order.paidAt ?? order.createdAt).toISOString().slice(0, 10)}
                        {order.isTestMode ? " · test mode" : ""}
                      </span>
                      {order.stripePaymentIntentId ? (
                        <details className="mt-1">
                          <summary className="subtle cursor-pointer text-[11px] hover:text-ink">
                            Provider reference
                          </summary>
                          <span className="mt-0.5 block break-all font-mono text-[10.5px] text-ink-subtle">
                            {order.stripePaymentIntentId}
                          </span>
                        </details>
                      ) : null}
                    </td>
                    <td className="max-w-[200px]">
                      <span className="block truncate text-[12.5px]">
                        {order.buyer.displayName}
                      </span>
                      <span className="subtle block truncate text-[11.5px]">
                        @{order.buyer.username}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={order.status} />
                        {order.dispute ? (
                          <Link href="/admin/disputes">
                            <StatusBadge status={order.dispute.status} />
                          </Link>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-right font-medium tabular-nums">
                      {formatMoney(order.totalMinor, order.currency)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-positive">
                      {formatMoney(order.platformFeeMinor, order.currency)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">
                      {formatMoney(order.sellerNetMinor, order.currency)}
                    </td>
                    <td className="whitespace-nowrap">
                      {order.payment ? (
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={order.payment.status} />
                          {order.payment.failureReason ? (
                            <span className="max-w-[180px] text-[11px] text-critical">
                              {order.payment.failureReason}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="subtle text-[11.5px]">no record</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {result.total > 0 ? (
        <p className="subtle text-[11.5px]">
          Refund requests and their provider-side execution live in{" "}
          <Link href="/admin/refunds" className="underline hover:text-ink">
            Refunds
          </Link>
          .
        </p>
      ) : null}

      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </div>
  );
}
