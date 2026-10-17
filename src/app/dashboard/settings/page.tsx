import Link from "next/link";
import { BadgeCheck, Clock, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

import { ImageUploader } from "@/components/account/image-uploader";
import { SellerApplicationForm } from "@/components/forms/account-forms";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { updateSellerProfileAction } from "@/lib/account/actions";
import { requireSeller } from "@/lib/auth/session";
import { env, isStripeConfigured } from "@/lib/env";
import { formatBps } from "@/lib/commission";
import { prisma } from "@/lib/db";
import {
  finalizeStoreLogoAction,
  refreshConnectStatusAction,
  requestStoreLogoUpload,
  startConnectOnboardingAction,
} from "@/lib/seller/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Seller dashboard" };

const CONNECT_NOTICES: Record<string, { tone: "info" | "success" | "warning" | "error"; title: string; body: string }> = {
  return: {
    tone: "info",
    title: "Welcome back from Stripe",
    body: "Refresh the status below to confirm what Stripe has verified so far. Some checks continue in the background.",
  },
  refresh: {
    tone: "warning",
    title: "Stripe session expired",
    body: "The onboarding link had expired, so nothing was submitted. Start the onboarding again.",
  },
  country: {
    tone: "error",
    title: "Add your country first",
    body: "Stripe needs a two-letter country for your account. Save it in the store profile below, then start onboarding again.",
  },
  unavailable: {
    tone: "error",
    title: "Seller access required",
    body: "Only approved sellers can connect a payout account.",
  },
  unconfigured: {
    tone: "error",
    title: "Payments are not configured",
    body: "This deployment has no Stripe Connect credentials, so onboarding cannot start. An administrator must provision them.",
  },
};

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSeller();
  const seller = user.sellerProfile;
  const params = await searchParams;
  const connectKey = typeof params.connect === "string" ? params.connect : undefined;
  const notice = connectKey ? CONNECT_NOTICES[connectKey] : undefined;

  const globalRule = await prisma.commissionRule.findFirst({
    where: { scope: "GLOBAL", isActive: true },
    select: { rateBps: true },
  });
  const commissionBps = seller.commissionBps ?? globalRule?.rateBps ?? env.marketplace.defaultCommissionBps;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Settings</h1>
        <p className="muted mt-1 text-[12.5px]">
          Your public store details and the Stripe account that receives your earnings.
        </p>
      </header>

      {notice ? (
        <Alert tone={notice.tone} title={notice.title}>
          {notice.body}
        </Alert>
      ) : null}

      {!isStripeConfigured ? (
        <Alert tone="error" title="Stripe is not configured on this deployment">
          Payments and payouts are disabled until an administrator provides the Stripe Connect keys.
          Nothing is simulated in the meantime.
        </Alert>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title="Store profile"
            description="Shown on your public store page and product listings."
          />
          <CardBody className="space-y-4">
            <ImageUploader
              title="Store logo"
              hint="Used as the banner at the top of your public store page."
              recommended="Wide images look best, around 1600×500."
              currentUrl={seller.logoUrl}
              fallback={seller.storeName.slice(0, 1).toUpperCase()}
              maxBytes={env.uploads.maxAvatarBytes}
              rounded="rounded"
              size="h-16 w-28"
              requestUpload={requestStoreLogoUpload}
              finalize={finalizeStoreLogoAction}
            />

            <div className="divider" />

            <SellerApplicationForm
              action={updateSellerProfileAction}
              submitLabel="Save store profile"
              defaults={{
                storeName: seller.storeName,
                slug: seller.slug,
                tagline: seller.tagline ?? "",
                about: seller.about ?? "",
                country: seller.country ?? user.country ?? "",
                websiteUrl: seller.websiteUrl ?? "",
                supportEmail: seller.supportEmail ?? user.email,
                applicationNote: seller.applicationNote ?? "",
              }}
            />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard
              label="Payout status"
              value={
                seller.stripePayoutsEnabled
                  ? "Enabled"
                  : seller.stripeDetailsSubmitted
                    ? "Verifying"
                    : "Not connected"
              }
              hint={
                seller.stripePayoutsEnabled
                  ? "Stripe can send your earnings."
                  : "Complete onboarding to receive money."
              }
              icon={
                seller.stripePayoutsEnabled ? (
                  <BadgeCheck className="size-4 text-positive" aria-hidden />
                ) : seller.stripeDetailsSubmitted ? (
                  <Clock className="size-4 text-caution" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4 text-caution" aria-hidden />
                )
              }
              tone={seller.stripePayoutsEnabled ? "positive" : "caution"}
            />
            <StatCard
              label="Commission"
              value={formatBps(commissionBps)}
              hint="Deducted from each sale before your earning is recorded."
            />
          </div>

          <Card>
            <CardHeader title="Payout account" description="Handled entirely by Stripe." />
            <CardBody className="space-y-3.5">
              <ul className="space-y-1.5 text-[12.5px] text-ink-muted">
                <li>
                  Connected account:{" "}
                  <span className="font-mono text-[11.5px] text-ink">
                    {seller.stripeAccountId ?? "not created"}
                  </span>
                </li>
                <li>Charges enabled: {seller.stripeChargesEnabled ? "yes" : "no"}</li>
                <li>Payouts enabled: {seller.stripePayoutsEnabled ? "yes" : "no"}</li>
                <li>Details submitted: {seller.stripeDetailsSubmitted ? "yes" : "no"}</li>
                {seller.stripeOnboardedAt ? (
                  <li className="subtle">
                    Onboarded {seller.stripeOnboardedAt.toISOString().slice(0, 10)}
                  </li>
                ) : null}
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                <form action={startConnectOnboardingAction}>
                  <Button type="submit" variant="primary" size="sm" disabled={!isStripeConfigured}>
                    <ExternalLink className="size-3.5" aria-hidden />
                    {seller.stripeAccountId ? "Continue onboarding" : "Connect Stripe"}
                  </Button>
                </form>

                {seller.stripeAccountId ? (
                  <form action={refreshConnectStatusAction}>
                    <Button type="submit" variant="secondary" size="sm">
                      <RefreshCw className="size-3.5" aria-hidden />
                      Refresh status
                    </Button>
                  </form>
                ) : null}
              </div>

              <p className="subtle text-[11.5px] leading-relaxed">
                Identity documents and bank details are collected by Stripe on its own pages and never
                reach this application. Status is read back from Stripe&apos;s API, not from the
                browser.{" "}
                <Link href="/legal/seller-agreement" className="text-accent hover:underline">
                  Seller agreement
                </Link>
              </p>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
