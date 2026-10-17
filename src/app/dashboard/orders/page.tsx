import Link from "next/link";
import { Receipt } from "lucide-react";

import { EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { formatBps } from "@/lib/commission";
import { formatMoney } from "@/lib/money";
import { listSellerOrderItems } from "@/lib/seller/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders · Seller dashboard" };

export default async function DashboardOrdersPage() {
  const user = await requireSeller();
  const items = await listSellerOrderItems(user.sellerProfile.id);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Orders</h1>
        <p className="muted mt-1 text-[12.5px]">
          Your lines from orders that settled. Commission is calculated from the rule that applied at
          the time of sale and is stored on each line.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Order lines"
          description={`Showing the ${items.length} most recent lines.`}
        />

        {items.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="When a buyer pays for one of your listings, the order line appears here."
            icon={<Receipt className="size-5" aria-hidden />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Commission</th>
                  <th className="text-right">You earn</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="max-w-[240px]">
                      <Link
                        href={`/product/${item.product.slug}`}
                        className="block truncate font-medium hover:text-accent"
                      >
                        {item.titleSnapshot}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap font-mono text-[11.5px] text-ink-muted">
                      {item.order.orderNumber}
                    </td>
                    <td className="max-w-[160px] truncate text-[12.5px]">
                      {item.order.buyer.displayName}
                      <span className="subtle block text-[11.5px]">
                        @{item.order.buyer.username}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-[12.5px] text-ink-muted">
                      {(item.order.paidAt ?? item.createdAt).toISOString().slice(0, 10)}
                      {item.order.isTestMode ? (
                        <Badge className="ml-1.5" tone="caution">
                          test
                        </Badge>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">
                      {formatMoney(item.priceMinor, item.currency)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-ink-muted">
                      {formatMoney(item.platformFeeMinor, item.currency)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums font-medium">
                      {formatMoney(item.sellerNetMinor - item.refundedMinor, item.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="subtle text-[12px]">
        Commission shown is the stored rate for each line, taken from the platform rule that applied
        when the sale settled (for example {formatBps(1500)}). Refunded amounts are deducted from
        what you earn.
      </p>
    </div>
  );
}
