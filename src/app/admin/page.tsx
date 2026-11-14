import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeEuro,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Flag,
  Gavel,
  LifeBuoy,
  Megaphone,
  Package,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Users,
  Wallet,
} from "lucide-react";

import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { formatTotals } from "@/lib/admin/format";
import { getAdminOverview, getAdminOverviewExtras } from "@/lib/admin/queries";
import { env, isStripeConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

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
  const [overview, extras] = await Promise.all([getAdminOverview(), getAdminOverviewExtras()]);

  const gross = formatTotals(overview.gross);
  const platformFees = formatTotals(overview.platformFees);
  const sellerNet = formatTotals(overview.sellerNet);
  const refunded = formatTotals(overview.refunded);
  const pendingPayouts = formatTotals(overview.payouts.pending);
  const paidPayouts = formatTotals(overview.payouts.paid);

  const openQueues = QUEUES.filter((queue) => overview.queues[queue.key] > 0);
  const ownerVerified = Boolean(
    extras.ownerUser?.emailVerified &&
      extras.ownerUser.role === "ADMIN" &&
      extras.ownerUser.status === "ACTIVE",
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Platform overview</h1>
          <p className="muted mt-1 text-[12.5px]">
            Real-time aggregate health, revenue, moderation queues, and email-verified staff access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link href="/admin/access" className="btn btn-secondary btn-sm">
            Access by email
          </Link>
          <Link href="/admin/coupons" className="btn btn-secondary btn-sm">
            Promo codes
          </Link>
          <Link href="/admin/settings" className="btn btn-secondary btn-sm">
            Settings
          </Link>
          <Link href="/admin/audit" className="btn btn-secondary btn-sm">
            Audit log
          </Link>
        </div>
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

      <Card>
        <CardHeader
          title="Platform readiness & owner security"
          description="Email-verified administration ownership, database migrations, checkout readiness, and storefront status."
        />
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/admin/access"
            className="surface-elevated flex flex-col justify-between gap-2.5 p-3 transition-colors hover:border-line-strong"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
                <ShieldCheck className="size-3.5 text-accent" aria-hidden />
                Owner email
              </span>
              {ownerVerified ? (
                <Badge tone="positive">active</Badge>
              ) : extras.ownerUser ? (
                <Badge tone="caution">verify email</Badge>
              ) : (
                <Badge tone="caution">awaiting login</Badge>
              )}
            </div>
            <div>
              <p className="truncate font-mono text-[12px] font-medium text-ink">
                {extras.ownerEmail}
              </p>
              <p className="subtle mt-0.5 text-[11.5px]">
                {ownerVerified
                  ? `Verified owner (@${extras.ownerUser?.username})`
                  : extras.ownerUser
                    ? "Confirm email to activate protected ADMIN role"
                    : "Sign in on /login via Email link to claim"}
              </p>
            </div>
          </Link>

          <div className="surface-elevated flex flex-col justify-between gap-2.5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
                <Database className="size-3.5 text-ink-subtle" aria-hidden />
                Database schema
              </span>
              {extras.marketplaceSchemaReady ? (
                <Badge tone="positive">ready</Badge>
              ) : (
                <Badge tone="caution">migration pending</Badge>
              )}
            </div>
            <div>
              <p className="text-[12px] font-medium text-ink">
                {extras.marketplaceSchemaReady
                  ? "All tables migrated"
                  : "Pending 20261114 migration"}
              </p>
              <p className="subtle mt-0.5 text-[11.5px]">
                {extras.marketplaceSchemaReady
                  ? "Bundles, coupons, and product Q&A are active."
                  : "Run npx prisma migrate deploy for bundles, coupons & Q&A."}
              </p>
            </div>
          </div>

          <div className="surface-elevated flex flex-col justify-between gap-2.5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
                <CreditCard className="size-3.5 text-ink-subtle" aria-hidden />
                Stripe payments
              </span>
              {isStripeConfigured ? (
                <Badge tone="positive">connected</Badge>
              ) : (
                <Badge tone="caution">missing key</Badge>
              )}
            </div>
            <div>
              <p className="text-[12px] font-medium text-ink">
                {isStripeConfigured ? "Checkout & payouts armed" : "STRIPE_SECRET_KEY unset"}
              </p>
              <p className="subtle mt-0.5 text-[11.5px]">
                {env.stripe.webhookSecret
                  ? "Webhook signature secret configured."
                  : "Set STRIPE_WEBHOOK_SECRET in deployment env."}
              </p>
            </div>
          </div>

          <Link
            href="/admin/settings"
            className="surface-elevated flex flex-col justify-between gap-2.5 p-3 transition-colors hover:border-line-strong"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
                <Megaphone className="size-3.5 text-ink-subtle" aria-hidden />
                Storefront &amp; Q&amp;A
              </span>
              {extras.announcement?.enabled ? (
                <Badge tone="positive">banner live</Badge>
              ) : extras.announcement ? (
                <Badge tone="caution">banner paused</Badge>
              ) : (
                <Badge>banner off</Badge>
              )}
            </div>
            <div>
              <p className="text-[12px] font-medium text-ink">
                {extras.unansweredQuestions} unanswered question
                {extras.unansweredQuestions === 1 ? "" : "s"}
              </p>
              <p className="subtle mt-0.5 truncate text-[11.5px]">
                {extras.discordUrl ? "Discord invite configured" : "No Discord invite URL set"}
              </p>
            </div>
          </Link>
        </CardBody>
      </Card>

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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent orders"
            description="Latest checkout records created on the platform."
            actions={
              <Link href="/admin/orders" className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
                View all
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          {extras.recentOrders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description="Paid and pending checkouts will appear here."
              icon={<ShoppingBag className="size-5" aria-hidden />}
            />
          ) : (
            <ul className="divide-y divide-line">
              {extras.recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-medium text-ink">
                        {order.orderNumber}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="subtle truncate text-[11.5px]">
                      @{order.buyer.username} · {order.buyer.email}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums text-ink">
                      {formatMoney(order.totalMinor, order.currency)}
                    </p>
                    <p className="subtle text-[11px] tabular-nums">
                      {order.createdAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            description="Immutable staff actions and automatic security events."
            actions={
              <Link href="/admin/audit" className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
                Full log
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          {extras.recentAuditLogs.length === 0 ? (
            <EmptyState
              title="No activity logged yet"
              description="Sign-ins, moderation decisions, and setting changes are recorded here."
              icon={<ScrollText className="size-5" aria-hidden />}
            />
          ) : (
            <ul className="divide-y divide-line">
              {extras.recentAuditLogs.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
                      <span className="truncate font-mono text-[12px] font-medium text-ink">
                        {entry.action}
                      </span>
                    </div>
                    <p className="subtle truncate text-[11.5px]">
                      {entry.actor ? `@${entry.actor.username}` : "system"}
                      {entry.entityType ? ` · ${entry.entityType}` : ""}
                    </p>
                  </div>
                  <span className="subtle shrink-0 text-[11px] tabular-nums">
                    {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
