import Link from "next/link";
import {
  AlertTriangle,
  BadgeEuro,
  Banknote,
  Clock,
  CreditCard,
  Flag,
  Gavel,
  LifeBuoy,
  Package,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Users,
  Wallet,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { formatTotals } from "@/lib/admin/format";
import { getAdminOverview } from "@/lib/admin/queries";
import { env, isStripeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin overview" };

const QUEUES = [
  {
    key: "sellerApplications" as const,
    href: "/admin/sellers",
    label: "Seller applications",
    icon: Store,
    description: "Waiting for a decision before these accounts can list products.",
  },
  {
    key: "productReviews" as const,
    href: "/admin/products",
    label: "Products in review",
    icon: Package,
    description: "Listings submitted by sellers and not yet published.",
  },
  {
    key: "refunds" as const,
    href: "/admin/refunds",
    label: "Refund requests",
    icon: CreditCard,
    description: "Requested or approved, but not yet returned through the payment provider.",
  },
  {
    key: "disputes" as const,
    href: "/admin/disputes",
    label: "Open disputes",
    icon: Gavel,
    description: "Chargebacks reported by the payment provider that still need a response.",
  },
  {
    key: "payouts" as const,
    href: "/admin/payouts",
    label: "Payouts to release",
    icon: Wallet,
    description: "Reserved seller balances awaiting a transfer.",
  },
  {
    key: "reports" as const,
    href: "/admin/reports",
    label: "Open reports",
    icon: Flag,
    description: "Reports filed by buyers against products, sellers or reviews.",
  },
  {
    key: "tickets" as const,
    href: "/admin/tickets",
    label: "Support tickets",
    icon: LifeBuoy,
    description: "Conversations that still need a staff reply.",
  },
];

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();

  const gross = formatTotals(overview.gross);
  const platformFees = formatTotals(overview.platformFees);
  const sellerNet = formatTotals(overview.sellerNet);
  const refunded = formatTotals(overview.refunded);
  const pendingPayouts = formatTotals(overview.payouts.pending);
  const paidPayouts = formatTotals(overview.payouts.paid);

  const openQueues = QUEUES.filter((queue) => overview.queues[queue.key] > 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Platform overview</h1>
        <p className="muted mt-1 text-[12.5px]">
          Every figure is an aggregate of stored records. Commission is the amount actually written
          onto paid order lines, not an estimate.
        </p>
      </header>

      {!isStripeConfigured ? (
        <Alert tone="warning" title="Stripe is not configured">
          Payments, refunds and payouts cannot move money until <code>STRIPE_SECRET_KEY</code> is
          set. Nothing is simulated in its absence — the actions fail with an explicit error.
        </Alert>
      ) : null}

      {overview.orders.disputed > 0 ? (
        <Alert tone="error" title={`${overview.orders.disputed} disputed order(s)`}>
          Chargebacks have evidence deadlines. Open{" "}
          <Link href="/admin/disputes" className="underline">
            Disputes
          </Link>{" "}
          to review them.
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross merchandise"
          value={gross.value}
          hint={gross.hint ?? "Paid order lines, all time"}
          icon={<BadgeEuro className="size-4" aria-hidden />}
        />
        <StatCard
          label="Platform commission"
          value={platformFees.value}
          hint={platformFees.hint ?? "Default rate 15% unless a rule overrides it"}
          icon={<ShieldCheck className="size-4" aria-hidden />}
          tone="positive"
        />
        <StatCard
          label="Seller earnings"
          value={sellerNet.value}
          hint={sellerNet.hint ?? "Gross minus commission"}
          icon={<Wallet className="size-4" aria-hidden />}
        />
        <StatCard
          label="Refunded"
          value={refunded.value}
          hint={refunded.hint ?? "Refunds confirmed as processed"}
          icon={<CreditCard className="size-4" aria-hidden />}
          tone="caution"
        />

        <StatCard
          label="Paid orders"
          value={overview.orders.paid.toLocaleString("en-GB")}
          hint={`${overview.orders.last30Days} in the last 30 days`}
          icon={<ShoppingBag className="size-4" aria-hidden />}
        />
        <StatCard
          label="Pending payouts"
          value={pendingPayouts.value}
          hint={
            pendingPayouts.hint ??
            `${overview.payouts.pendingCount} request${overview.payouts.pendingCount === 1 ? "" : "s"} reserved`
          }
          icon={<Clock className="size-4" aria-hidden />}
          tone="caution"
        />
        <StatCard
          label="Paid out"
          value={paidPayouts.value}
          hint={paidPayouts.hint ?? "Transferred to seller accounts"}
          icon={<Banknote className="size-4" aria-hidden />}
        />
        <StatCard
          label="Commission default"
          value={`${(env.marketplace.defaultCommissionBps / 100).toFixed(2)}%`}
          hint={`${env.marketplace.earningsHoldDays}-day earnings hold`}
          icon={<ShieldCheck className="size-4" aria-hidden />}
          tone="accent"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accounts"
          value={overview.users.total.toLocaleString("en-GB")}
          hint={`${overview.users.active} active · ${overview.users.suspended} suspended · ${overview.users.admins} admin`}
          icon={<Users className="size-4" aria-hidden />}
        />
        <StatCard
          label="Sellers"
          value={overview.sellers.approved.toLocaleString("en-GB")}
          hint={`${overview.sellers.pending} pending · ${overview.sellers.suspended} suspended · ${overview.sellers.payoutsEnabled} payout-ready`}
          icon={<Store className="size-4" aria-hidden />}
        />
        <StatCard
          label="Products"
          value={overview.products.total.toLocaleString("en-GB")}
          hint={`${overview.products.published} published · ${overview.products.inReview} in review · ${overview.products.draft} draft`}
          icon={<Package className="size-4" aria-hidden />}
        />
        <StatCard
          label="Catalogue"
          value={overview.catalog.categories.toLocaleString("en-GB")}
          hint={`${overview.catalog.categories} categories · ${overview.catalog.reviews} reviews`}
          icon={<Star className="size-4" aria-hidden />}
        />
      </section>

      <Card>
        <CardHeader
          title="Work queues"
          description="Items that need a staff decision. Counts update as they are handled."
        />
        <CardBody className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {QUEUES.map((queue) => {
            const count = overview.queues[queue.key];
            const Icon = queue.icon;
            return (
              <Link
                key={queue.key}
                href={queue.href}
                className="surface-elevated flex items-start gap-3 p-3 transition-colors hover:border-line-strong"
              >
                <span className="mt-0.5 text-ink-subtle">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{queue.label}</span>
                    {count > 0 ? (
                      <Badge tone="caution">{count}</Badge>
                    ) : (
                      <Badge tone="positive">clear</Badge>
                    )}
                  </span>
                  <span className="muted mt-0.5 block text-[11.5px] leading-relaxed">
                    {queue.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </CardBody>
      </Card>

      {openQueues.length === 0 ? (
        <Alert tone="success" title="All queues are clear">
          There is nothing waiting for review, approval or release right now.
        </Alert>
      ) : (
        <div className="flex items-start gap-2 text-[12.5px] text-ink-muted">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-caution" aria-hidden />
          <p>
            {openQueues.reduce((total, queue) => total + overview.queues[queue.key], 0)} item(s)
            across {openQueues.length} queue{openQueues.length === 1 ? "" : "s"} need attention.
          </p>
        </div>
      )}
    </div>
  );
}
