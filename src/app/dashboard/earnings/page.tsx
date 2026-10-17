import Link from "next/link";
import { BadgeEuro, Banknote, Clock, Wallet } from "lucide-react";

import { PayoutRequestForm } from "@/components/dashboard/payout-form";
import { Alert, EmptyState } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { formatBps } from "@/lib/commission";
import { formatMoney } from "@/lib/money";
import { requestPayoutAction } from "@/lib/seller/actions";
import {
  getSellerOverview,
  listSellerEarnings,
  listSellerPayouts,
  type CurrencyTotals,
} from "@/lib/seller/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings · Seller dashboard" };

function primary(totals: CurrencyTotals, currency: string): number {
  return totals[currency] ?? 0;
}

function otherCurrencies(totals: CurrencyTotals, currency: string): string | undefined {
  const rows = Object.entries(totals).filter(([code, minor]) => code !== currency && minor !== 0);
  if (rows.length === 0) return undefined;
  return `Also ${rows.map(([code, minor]) => formatMoney(minor, code)).join(", ")}`;
}

export default async function DashboardEarningsPage() {
  const user = await requireSeller();
  const seller = user.sellerProfile;
  const currency = seller.payoutCurrency;

  const [overview, earnings, payouts] = await Promise.all([
    getSellerOverview(seller.id),
    listSellerEarnings(seller.id),
    listSellerPayouts(seller.id),
  ]);

  const availableMinor = primary(overview.available, currency);
  const pendingMinor = primary(overview.pending, currency);
  const paidOutMinor = primary(overview.paidOut, currency);
  const reversedMinor = primary(overview.reversed, currency);

  const openPayout = payouts.find((payout) => payout.status === "PENDING");
  const canRequest = availableMinor > 0 && !openPayout && seller.stripePayoutsEnabled;

  const disabledReason = !seller.stripePayoutsEnabled
    ? "Connect a Stripe payout account in Settings before requesting a payout."
    : openPayout
      ? `A payout of ${formatMoney(openPayout.amountMinor, openPayout.currency)} is already awaiting review.`
      : availableMinor <= 0
        ? "Nothing is payable yet. Earnings become available once the hold period ends."
        : undefined;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Earnings</h1>
        <p className="muted mt-1 text-[12.5px]">
          Platform commission is deducted before an earning is recorded. The marketplace never holds
          a spendable balance of its own: these figures mirror what is owed to you.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available balance"
          value={formatMoney(availableMinor, currency)}
          hint={otherCurrencies(overview.available, currency) ?? "Ready to pay out"}
          icon={<Wallet className="size-4" aria-hidden />}
          tone="accent"
        />
        <StatCard
          label="Pending earnings"
          value={formatMoney(pendingMinor, currency)}
          hint={otherCurrencies(overview.pending, currency) ?? "Inside the hold period"}
          icon={<Clock className="size-4" aria-hidden />}
          tone="caution"
        />
        <StatCard
          label="Paid out"
          value={formatMoney(paidOutMinor, currency)}
          hint={otherCurrencies(overview.paidOut, currency) ?? "Transferred through Stripe"}
          icon={<Banknote className="size-4" aria-hidden />}
        />
        <StatCard
          label="Reversed"
          value={formatMoney(reversedMinor, currency)}
          hint={otherCurrencies(overview.reversed, currency) ?? "Refunded or disputed sales"}
          icon={<BadgeEuro className="size-4" aria-hidden />}
          tone="caution"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title="Earning ledger"
            description="One row per order line, with the commission that was applied."
          />
          {earnings.length === 0 ? (
            <EmptyState
              title="No earnings yet"
              description="Earnings appear as soon as an order settles."
              icon={<BadgeEuro className="size-5" aria-hidden />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Fee</th>
                    <th className="text-right">Net</th>
                    <th>Available from</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((earning) => (
                    <tr key={earning.id}>
                      <td className="max-w-[200px] truncate">{earning.orderItem.titleSnapshot}</td>
                      <td className="whitespace-nowrap font-mono text-[11.5px] text-ink-muted">
                        {earning.orderItem.order.orderNumber}
                      </td>
                      <td>
                        <StatusBadge status={earning.status} />
                        {earning.reversalReason ? (
                          <span className="subtle mt-0.5 block text-[11px]">
                            {earning.reversalReason}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {formatMoney(earning.grossMinor, earning.currency)}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums text-ink-muted">
                        {formatMoney(earning.platformFeeMinor, earning.currency)}
                        <span className="subtle ml-1 text-[11px]">
                          {formatBps(earning.orderItem.commissionBps)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums font-medium">
                        {formatMoney(earning.netMinor, earning.currency)}
                      </td>
                      <td className="whitespace-nowrap text-[12.5px] text-ink-muted">
                        {earning.availableAt
                          ? earning.availableAt.toISOString().slice(0, 10)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Request a payout" />
            <CardBody>
              <PayoutRequestForm
                action={requestPayoutAction}
                disabled={!canRequest}
                disabledReason={disabledReason}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payouts" />
            {payouts.length === 0 ? (
              <CardBody>
                <p className="muted text-[12.5px]">No payouts requested yet.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {payouts.map((payout) => (
                  <li key={payout.id} className="space-y-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium tabular-nums">
                        {formatMoney(payout.amountMinor, payout.currency)}
                      </span>
                      <StatusBadge status={payout.status} />
                    </div>
                    <p className="subtle text-[11.5px]">
                      Requested {payout.createdAt.toISOString().slice(0, 10)} ·{" "}
                      {payout._count.earnings} earning{payout._count.earnings === 1 ? "" : "s"}
                    </p>
                    {payout.stripeTransferId ? (
                      <p className="subtle truncate font-mono text-[11px]">
                        {payout.stripeTransferId}
                      </p>
                    ) : null}
                    {payout.failureReason ? (
                      <p className="text-[11.5px] text-critical">{payout.failureReason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!seller.stripePayoutsEnabled ? (
            <Alert tone="warning" title="Stripe payouts are not enabled">
              <Link href="/dashboard/settings" className="underline">
                Finish account onboarding
              </Link>{" "}
              so earnings can be transferred to you.
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
}
