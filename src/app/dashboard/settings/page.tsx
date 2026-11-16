import Link from "next/link";
import { BadgeCheck, Clock, ShieldCheck } from "lucide-react";

import { ImageUploader } from "@/components/account/image-uploader";
import { ConnectStripeControls } from "@/components/dashboard/connect-stripe-form";
import { SellerApplicationForm } from "@/components/forms/account-forms";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { updateSellerProfileAction } from "@/lib/account/actions";
import { requireSeller } from "@/lib/auth/session";
import { formatBps } from "@/lib/commission";
import { prisma } from "@/lib/db";
import { env, isStripeConfigured } from "@/lib/env";
import {
  MissingStripeAccountError,
  isSupportedConnectCountry,
  retrieveConnectStatus,
} from "@/lib/payments/connect";
import {
  finalizeStoreLogoAction,
  refreshConnectStatusAction,
  requestStoreLogoUpload,
  startConnectOnboardingAction,
} from "@/lib/seller/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Seller dashboard" };

type ConnectNotice = {
  tone: "info" | "success" | "warning" | "error";
  title: string;
  body: string;
};

const CONNECT_NOTICES: Record<string, ConnectNotice> = {
  return: {
    tone: "info",
    title: "Welcome back from Stripe",
    body: "Click Refresh status below to confirm what Stripe has verified so far. Some checks continue in the background.",
  },
  refresh: {
    tone: "warning",
    title: "Stripe session expired",
    body: "The onboarding link had expired or was interrupted, so nothing was lost. Click Connect Stripe again to open a fresh link.",
  },
  country: {
    tone: "error",
    title: "Add your country first",
    body: "Stripe needs a two-letter country for your account. Save it in Store profile below, then start onboarding again.",
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
  let notice: ConnectNotice | undefined = connectKey ? CONNECT_NOTICES[connectKey] : undefined;

  let stripeAccountId = seller.stripeAccountId;
  let stripeChargesEnabled = seller.stripeChargesEnabled;
  let stripePayoutsEnabled = seller.stripePayoutsEnabled;
  let stripeDetailsSubmitted = seller.stripeDetailsSubmitted;
  let stripeOnboardedAt = seller.stripeOnboardedAt;

  // When Stripe returns the seller from hosted onboarding, pull live account status immediately.
  if (connectKey === "return" && stripeAccountId && isStripeConfigured) {
    try {
      const liveStatus = await retrieveConnectStatus(stripeAccountId);
      const nextOnboardedAt = liveStatus.detailsSubmitted
        ? (stripeOnboardedAt ?? new Date())
        : null;

      await prisma.sellerProfile.update({
        where: { id: seller.id },
        data: {
          stripeChargesEnabled: liveStatus.chargesEnabled,
          stripePayoutsEnabled: liveStatus.payoutsEnabled,
          stripeDetailsSubmitted: liveStatus.detailsSubmitted,
          stripeOnboardedAt: nextOnboardedAt,
        },
      });

      stripeChargesEnabled = liveStatus.chargesEnabled;
      stripePayoutsEnabled = liveStatus.payoutsEnabled;
      stripeDetailsSubmitted = liveStatus.detailsSubmitted;
      stripeOnboardedAt = nextOnboardedAt;

      if (liveStatus.payoutsEnabled) {
        notice = {
          tone: "success",
          title: "Stripe payout account connected",
          body: "Stripe verified your payout details. Payouts and seller transfers are enabled.",
        };
      } else if (liveStatus.requirementsCurrentlyDue.length > 0) {
        notice = {
          tone: "warning",
          title: "Stripe needs a few more details",
          body: `Stripe still requires ${liveStatus.requirementsCurrentlyDue.length} detail${
            liveStatus.requirementsCurrentlyDue.length === 1 ? "" : "s"
          } before enabling payouts. Click Continue onboarding below to finish.`,
        };
      } else if (liveStatus.detailsSubmitted) {
        notice = {
          tone: "info",
          title: "Details submitted to Stripe",
          body: "Stripe received your onboarding details and is completing verification. Click Refresh status shortly to check for approval.",
        };
      }
    } catch (error) {
      if (error instanceof MissingStripeAccountError) {
        await prisma.sellerProfile.update({
          where: { id: seller.id },
          data: {
            stripeAccountId: null,
            stripeChargesEnabled: false,
            stripePayoutsEnabled: false,
            stripeDetailsSubmitted: false,
            stripeOnboardedAt: null,
          },
        });
        stripeAccountId = null;
        stripeChargesEnabled = false;
        stripePayoutsEnabled = false;
        stripeDetailsSubmitted = false;
        stripeOnboardedAt = null;
        notice = {
          tone: "warning",
          title: "Stripe account reference reset",
          body: "The previous Stripe account ID was not found in the active Stripe mode and has been cleared. Click Connect Stripe to set up a fresh account.",
        };
      } else {
        console.warn("[dashboard/settings] Could not auto-sync Stripe status on return:", error);
      }
    }
  }

  const globalRule = await prisma.commissionRule.findFirst({
    where: { scope: "GLOBAL", isActive: true },
    select: { rateBps: true },
  });
  const commissionBps = seller.commissionBps ?? globalRule?.rateBps ?? env.marketplace.defaultCommissionBps;
  const hasSupportedCountry = isSupportedConnectCountry(seller.country ?? user.country);

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
                stripePayoutsEnabled
                  ? "Enabled"
                  : stripeDetailsSubmitted
                    ? "Verifying"
                    : "Not connected"
              }
              hint={
                stripePayoutsEnabled
                  ? "Stripe can send your earnings."
                  : "Complete onboarding to receive money."
              }
              icon={
                stripePayoutsEnabled ? (
                  <BadgeCheck className="size-4 text-positive" aria-hidden />
                ) : stripeDetailsSubmitted ? (
                  <Clock className="size-4 text-caution" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4 text-caution" aria-hidden />
                )
              }
              tone={stripePayoutsEnabled ? "positive" : "caution"}
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
                    {stripeAccountId ?? "not created"}
                  </span>
                </li>
                <li>Charges enabled: {stripeChargesEnabled ? "yes" : "no"}</li>
                <li>Payouts enabled: {stripePayoutsEnabled ? "yes" : "no"}</li>
                <li>Details submitted: {stripeDetailsSubmitted ? "yes" : "no"}</li>
                {stripeOnboardedAt ? (
                  <li className="subtle">
                    Onboarded {stripeOnboardedAt.toISOString().slice(0, 10)}
                  </li>
                ) : null}
              </ul>

              {!hasSupportedCountry && !stripeAccountId ? (
                <Alert tone="warning" title="Country code needed first">
                  Save a two-letter ISO country code (e.g.{" "}
                  <span className="font-mono">HR</span> or <span className="font-mono">US</span>)
                  in Store profile before connecting Stripe.
                </Alert>
              ) : null}

              <ConnectStripeControls
                startAction={startConnectOnboardingAction}
                refreshAction={refreshConnectStatusAction}
                hasAccount={Boolean(stripeAccountId)}
                disabled={!isStripeConfigured}
              />

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
