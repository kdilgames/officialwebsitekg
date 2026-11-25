import { Share2 } from "lucide-react";

import { AffiliateCodeForm } from "@/components/account/affiliate-controls";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { saveAffiliateCodeAction } from "@/lib/affiliate/actions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Affiliate program",
  description: "Share KDILGAMES marketplace links and earn referral commissions.",
};

export default async function AccountAffiliatePage() {
  const user = await requireUser("/account/affiliate");

  const result = await withSchemaFallback(
    async () => {
      const account = await prisma.affiliateAccount.findUnique({
        where: { userId: user.id },
        include: {
          referrals: {
            orderBy: { createdAt: "desc" },
            take: 25,
            include: {
              order: { select: { orderNumber: true, totalMinor: true, currency: true } },
            },
          },
        },
      });
      return { migrated: true, account };
    },
    { migrated: false, account: null },
  );

  const account = result.account;
  const suggestedCode = user.username
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 16) || "CREATOR";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <Share2 className="size-4 text-accent" aria-hidden />
          Affiliate program
        </h1>
        <p className="muted mt-1 text-[12.5px]">
          Share links to KDILGAMES listings and earn{" "}
          {((account?.commissionBps ?? 1000) / 100).toFixed(0)}% referral commission on qualifying
          orders placed within 30 days of a visitor click (self-referrals excluded).
        </p>
      </header>

      {!result.migrated ? (
        <Alert tone="warning" title="Database migration pending">
          Run <code>npm run db:deploy</code> to enable affiliate link tracking and commissions.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Referral clicks" value={String(account?.clicks ?? 0)} />
        <StatCard label="Conversions" value={String(account?.conversions ?? 0)} />
        <StatCard
          label="Total earned"
          value={formatMoney(account?.earnedMinor ?? 0, account?.currency ?? "EUR")}
          hint="Settled via support / payout request"
        />
      </div>

      <Card>
        <CardHeader
          title="Referral link & code"
          description="Set a custom code to share across YouTube, Discord, or blog posts."
        />
        <CardBody>
          <AffiliateCodeForm
            action={saveAffiliateCodeAction}
            currentCode={account?.code ?? null}
            suggestedCode={suggestedCode}
            siteUrl={env.siteUrl}
          />
        </CardBody>
      </Card>

      {account && account.referrals.length > 0 ? (
        <Card>
          <CardHeader title="Recent referred orders" />
          <div className="divide-y divide-line">
            {account.referrals.map((ref) => (
              <div
                key={ref.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]"
              >
                <div>
                  <p className="font-medium text-ink">Order {ref.order.orderNumber}</p>
                  <p className="subtle text-[11.5px]">{ref.createdAt.toISOString().slice(0, 10)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="positive">
                    +{formatMoney(ref.commissionMinor, ref.currency)}
                  </Badge>
                  <Badge tone="neutral">{ref.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
