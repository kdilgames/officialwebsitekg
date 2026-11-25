import Link from "next/link";
import { BarChart3, Download, KeyRound, ShoppingBag, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { isFlashSaleActive } from "@/lib/marketplace/flash-sale";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller analytics" };

export default async function SellerAnalyticsPage() {
  const user = await requireSeller();
  const sellerId = user.sellerProfile.id;
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [orderItems30d, totalDownloads, activeLicenses, products] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        sellerId,
        status: { in: ["PAID", "REFUNDED"] },
        createdAt: { gte: since30d },
      },
      select: {
        priceMinor: true,
        sellerNetMinor: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.downloadRecord.count({
      where: { product: { sellerId } },
    }),
    withSchemaFallback(
      () => prisma.licenseKey.count({ where: { sellerId, status: "ACTIVE" } }),
      0,
    ),
    withSchemaFallback(
      () =>
        prisma.product.findMany({
          where: { sellerId },
          orderBy: { salesCount: "desc" },
          take: 12,
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            priceMinor: true,
            salePriceMinor: true,
            saleEndsAt: true,
            currency: true,
            salesCount: true,
            viewCount: true,
            ratingSum: true,
            ratingCount: true,
          },
        }),
      async () => {
        const legacy = await prisma.product.findMany({
          where: { sellerId },
          orderBy: { salesCount: "desc" },
          take: 12,
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            priceMinor: true,
            salePriceMinor: true,
            currency: true,
            salesCount: true,
            viewCount: true,
            ratingSum: true,
            ratingCount: true,
          },
        });
        return legacy.map((row) => ({ ...row, saleEndsAt: null as Date | null }));
      },
    ),
  ]);

  const paidItems = orderItems30d.filter((i) => i.status === "PAID");
  const refundedItems = orderItems30d.filter((i) => i.status === "REFUNDED");
  const gross30d = paidItems.reduce((sum, i) => sum + i.priceMinor, 0);
  const net30d = paidItems.reduce((sum, i) => sum + i.sellerNetMinor, 0);
  const currency = paidItems[0]?.currency ?? user.sellerProfile.payoutCurrency ?? "EUR";
  const avgOrderMinor = paidItems.length > 0 ? Math.round(gross30d / paidItems.length) : 0;
  const refundRate =
    orderItems30d.length > 0 ? ((refundedItems.length / orderItems30d.length) * 100).toFixed(1) : "0.0";

  // Build 14-day daily sales series.
  const days: Array<{ key: string; label: string; grossMinor: number; orders: number }> = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    days.push({ key, label: key.slice(5), grossMinor: 0, orders: 0 });
  }
  const dayMap = new Map(days.map((d) => [d.key, d]));
  for (const item of paidItems) {
    if (item.createdAt < since14d) continue;
    const bucket = dayMap.get(item.createdAt.toISOString().slice(0, 10));
    if (bucket) {
      bucket.grossMinor += item.priceMinor;
      bucket.orders += 1;
    }
  }
  const maxDayGross = Math.max(100, ...days.map((d) => d.grossMinor));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <BarChart3 className="size-4 text-accent" aria-hidden />
          Seller analytics
        </h1>
        <p className="muted mt-1 text-[12.5px]">
          Live store metrics over the past 30 days, calculated directly from settled orders.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="30d Gross sales"
          value={formatMoney(gross30d, currency)}
          hint={`Net: ${formatMoney(net30d, currency)}`}
        />
        <StatCard
          label="30d Paid orders"
          value={String(paidItems.length)}
          hint={`Avg: ${formatMoney(avgOrderMinor, currency)} · Refunds ${refundRate}%`}
        />
        <StatCard
          label="Total downloads"
          value={String(totalDownloads)}
          hint="Verified buyer deliveries"
        />
        <StatCard
          label="Active license keys"
          value={String(activeLicenses)}
          hint="Auto-issued per order"
        />
      </div>

      <Card>
        <CardHeader
          title="14-day daily sales"
          description="Daily gross sales volume (EUR) for the last two weeks."
        />
        <CardBody>
          <div className="flex h-44 items-end gap-1.5 sm:gap-2">
            {days.map((day) => {
              const heightPct = day.grossMinor > 0 ? Math.max(8, Math.round((day.grossMinor / maxDayGross) * 100)) : 4;
              return (
                <div key={day.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="flex w-full flex-1 items-end justify-center"
                    title={`${day.key}: ${formatMoney(day.grossMinor, currency)} (${day.orders} orders)`}
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[32px] rounded-t-md transition-all ${
                        day.grossMinor > 0 ? "bg-accent" : "bg-elevated border border-line"
                      }`}
                    />
                  </div>
                  <span className="subtle text-[10px] tabular-nums">{day.label}</span>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Product performance"
          description="Top listings ordered by total completed sales."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-line bg-elevated/50 text-[11px] uppercase tracking-wider text-ink-subtle">
              <tr>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  <span className="inline-flex items-center gap-1">
                    <ShoppingBag className="size-3" aria-hidden /> Sales
                  </span>
                </th>
                <th className="px-4 py-2.5 font-medium text-right">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="size-3" aria-hidden /> Views
                  </span>
                </th>
                <th className="px-4 py-2.5 font-medium text-right">Rating</th>
                <th className="px-4 py-2.5 font-medium text-right">Promo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted px-4 py-6 text-center">
                    No products published yet.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const flash = isFlashSaleActive(product, now);
                  const avgRating =
                    product.ratingCount > 0
                      ? `${(product.ratingSum / product.ratingCount).toFixed(1)} (${product.ratingCount})`
                      : "—";
                  return (
                    <tr key={product.id} className="hover:bg-elevated/40">
                      <td className="px-4 py-2.5 font-medium text-ink">
                        <Link href={`/dashboard/products/${product.id}`} className="hover:text-accent">
                          {product.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={product.status === "PUBLISHED" ? "positive" : "neutral"}>
                          {product.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{product.salesCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{product.viewCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{avgRating}</td>
                      <td className="px-4 py-2.5 text-right">
                        {flash ? (
                          <Badge tone="accent">Flash sale</Badge>
                        ) : product.salePriceMinor !== null &&
                          product.salePriceMinor < product.priceMinor ? (
                          <Badge tone="neutral">On sale</Badge>
                        ) : (
                          <span className="subtle">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3 text-[12px] text-ink-muted">
        <Link href="/dashboard/licenses" className="inline-flex items-center gap-1 hover:text-ink">
          <KeyRound className="size-3.5" aria-hidden /> Manage license keys
        </Link>
        <Link href="/dashboard/orders" className="inline-flex items-center gap-1 hover:text-ink">
          <Download className="size-3.5" aria-hidden /> View order ledger
        </Link>
      </div>
    </div>
  );
}
