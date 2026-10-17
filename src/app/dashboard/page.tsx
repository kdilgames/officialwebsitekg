import Link from "next/link";
import {
  BadgeEuro,
  Boxes,
  Clock,
  Eye,
  Package,
  PlusCircle,
  Receipt,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { Alert, EmptyState } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import {
  getSellerOverview,
  listSellerOrderItems,
  listSellerReviews,
  type CurrencyTotals,
} from "@/lib/seller/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller dashboard" };

function primary(totals: CurrencyTotals, currency: string): number {
  return totals[currency] ?? 0;
}

/** Lists any non-zero totals held in a currency other than the payout currency. */
function otherCurrencies(totals: CurrencyTotals, currency: string): string | undefined {
  const rows = Object.entries(totals).filter(([code, minor]) => code !== currency && minor !== 0);
  if (rows.length === 0) return undefined;
  return `Also ${rows.map(([code, minor]) => formatMoney(minor, code)).join(", ")}`;
}

export default async function DashboardOverviewPage() {
  const user = await requireSeller();
  const seller = user.sellerProfile;
  const currency = seller.payoutCurrency;

  const [overview, orders, reviews] = await Promise.all([
    getSellerOverview(seller.id),
    listSellerOrderItems(seller.id, 6),
    listSellerReviews(seller.id, 4),
  ]);

  const peak = Math.max(1, ...overview.trend.map((point: any) => point.minor));
  const averageRating =
    overview.rating.count > 0 ? overview.rating.sum / overview.rating.count : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Overview</h1>
          <p className="muted mt-1 text-[12.5px]">
            Every figure below is read from your orders, earnings and product records.
          </p>
        </div>
        <Link href="/dashboard/products/new" className={buttonClass("primary", "sm")}>
          <PlusCircle className="size-3.5" aria-hidden />
          New product
        </Link>
      </header>

      {!seller.stripePayoutsEnabled ? (
        <Alert tone="warning" title="Payouts are not enabled yet">
          Connect your Stripe account in{" "}
          <Link href="/dashboard/settings" className="underline">
            Settings
          </Link>{" "}
          so earnings can be transferred to you once they clear the hold period.
        </Alert>
      ) : null}

      {overview.products.inReview > 0 ? (
        <Alert tone="info" title="Products waiting for approval">
          {overview.products.inReview} listing{overview.products.inReview === 1 ? " is" : "s are"}{" "}
          queued for review. Approval is performed by platform staff, never by the seller.
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatMoney(primary(overview.revenue, currency), currency)}
          hint={otherCurrencies(overview.revenue, currency) ?? "Net of platform commission"}
          icon={<BadgeEuro className="size-4" aria-hidden />}
          tone="positive"
        />
        <StatCard
          label="Pending earnings"
          value={formatMoney(primary(overview.pending, currency), currency)}
          hint={otherCurrencies(overview.pending, currency) ?? "Inside the payout hold period"}
          icon={<Clock className="size-4" aria-hidden />}
          tone="caution"
        />
        <StatCard
          label="Available balance"
          value={formatMoney(primary(overview.available, currency), currency)}
          hint={otherCurrencies(overview.available, currency) ?? "Ready to request a payout"}
          icon={<Wallet className="size-4" aria-hidden />}
          tone="accent"
        />
        <StatCard
          label="Paid out"
          value={formatMoney(primary(overview.paidOut, currency), currency)}
          hint={otherCurrencies(overview.paidOut, currency) ?? "Transferred by Stripe"}
          icon={<Receipt className="size-4" aria-hidden />}
        />

        <StatCard
          label="Total sales"
          value={overview.sales.total.toLocaleString("en-GB")}
          hint={`${overview.sales.last30Days} in the last 30 days`}
          icon={<ShoppingBag className="size-4" aria-hidden />}
        />
        <StatCard
          label="Products"
          value={overview.products.total.toLocaleString("en-GB")}
          hint={`${overview.products.published} published · ${overview.products.drafts} draft`}
          icon={<Package className="size-4" aria-hidden />}
        />
        <StatCard
          label="Followers"
          value={overview.followers.toLocaleString("en-GB")}
          hint="Accounts following your store"
          icon={<Users className="size-4" aria-hidden />}
        />
        <StatCard
          label="Product views"
          value={overview.views.total.toLocaleString("en-GB")}
          hint={
            averageRating === null
              ? "No reviews yet"
              : `${averageRating.toFixed(2)} average from ${overview.rating.count} review${overview.rating.count === 1 ? "" : "s"}`
          }
          icon={<Eye className="size-4" aria-hidden />}
        />
      </section>

      <Card>
        <CardHeader
          title="Sales analytics"
          description="Net earnings per day over the last 30 days."
          actions={
            <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              <TrendingUp className="size-3.5" aria-hidden />
              Peak {formatMoney(peak, currency)}
            </span>
          }
        />
        <CardBody>
          {overview.trend.every((point: any) => point.minor === 0) ? (
            <p className="muted text-[12.5px]">
              No sales in the last 30 days yet. Figures appear here as soon as an order settles.
            </p>
          ) : (
            <div className="flex h-28 items-end gap-[3px]">
              {overview.trend.map((point: any) => (
                <div
                  key={point.day}
                  className="group relative flex-1 rounded-[3px] bg-accent/70"
                  style={{ height: `${Math.max(point.minor > 0 ? 4 : 1, (point.minor / peak) * 100)}%` }}
                  title={`${point.day}: ${formatMoney(point.minor, currency)}`}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent orders"
            description="Your lines from paid orders."
            actions={
              <Link href="/dashboard/orders" className="text-[12px] text-accent hover:underline">
                View all
              </Link>
            }
          />
          {orders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description="Once a buyer pays for one of your products it will appear here."
              icon={<Boxes className="size-5" aria-hidden />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th className="text-right">You earn</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((item: any) => (
                    <tr key={item.id}>
                      <td className="max-w-[220px]">
                        <Link
                          href={`/product/${item.product.slug}`}
                          className="block truncate font-medium hover:text-accent"
                        >
                          {item.titleSnapshot}
                        </Link>
                        <span className="subtle text-[11.5px]">
                          {item.order.paidAt
                            ? item.order.paidAt.toISOString().slice(0, 10)
                            : item.createdAt.toISOString().slice(0, 10)}
                          {item.order.isTestMode ? " · test mode" : ""}
                        </span>
                      </td>
                      <td className="font-mono text-[11.5px] text-ink-muted">
                        {item.order.orderNumber}
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(item.sellerNetMinor, item.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent reviews"
            description="Verified purchases only."
            actions={
              <Link href="/dashboard/reviews" className="text-[12px] text-accent hover:underline">
                View all
              </Link>
            }
          />
          {reviews.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              description="Buyers can review a product after their purchase settles."
              icon={<Star className="size-5" aria-hidden />}
            />
          ) : (
            <ul className="divide-y divide-line">
              {reviews.map((review: any) => (
                <li key={review.id} className="space-y-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/product/${review.product.slug}`}
                      className="truncate text-[13px] font-medium hover:text-accent"
                    >
                      {review.product.title}
                    </Link>
                    <span className="flex shrink-0 items-center gap-0.5 text-[12px] text-caution">
                      {Array.from({ length: review.rating }).map((_: any, index: number) => (
                        <Star key={index} className="size-3 fill-current" aria-hidden />
                      ))}
                    </span>
                  </div>
                  <p className="muted line-clamp-2 text-[12.5px]">{review.body}</p>
                  <p className="subtle text-[11.5px]">
                    {review.user.displayName} · {review.createdAt.toISOString().slice(0, 10)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
