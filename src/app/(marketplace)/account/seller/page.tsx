import Link from "next/link";
import { BadgeCheck, Clock, LayoutDashboard, ShieldCheck, Store, XCircle } from "lucide-react";

import { SellerApplicationForm } from "@/components/forms/account-forms";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { applyAsSellerAction, updateSellerProfileAction } from "@/lib/account/actions";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { bpsToPercent, formatBps } from "@/lib/commission";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";
export const metadata = { title: "Selling on KDILGAMES" };

export default async function SellerAccountPage() {
  const user = await requireUser("/account/seller");
  const profile = user.sellerProfile;

  // The advertised rate is the effective global commission: the highest-precedence
  // active rule that applies platform-wide, falling back to the configured default.
  const globalRule = await prisma.commissionRule.findFirst({
    where: { scope: "GLOBAL", isActive: true },
    select: { rateBps: true },
  });
  const commissionBps = globalRule?.rateBps ?? env.marketplace.defaultCommissionBps;
  const commission = formatBps(commissionBps);
  // What a seller keeps on a sale, ignoring per-category and per-product rules.
  const sellerSharePercent = Math.max(0, Math.round((100 - bpsToPercent(commissionBps)) * 100) / 100);

  const defaults = {
    storeName: profile?.storeName ?? user.displayName,
    slug: profile?.slug ?? slugify(user.username),
    tagline: profile?.tagline ?? "",
    about: profile?.about ?? "",
    country: profile?.country ?? user.country ?? "",
    websiteUrl: profile?.websiteUrl ?? "",
    supportEmail: profile?.supportEmail ?? user.email,
    applicationNote: profile?.applicationNote ?? "",
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Selling on KDILGAMES</h1>
          <p className="muted mt-1 text-[12.5px]">
            Platform commission {commission} per sale · paid out through Stripe Connect
          </p>
        </div>
        {profile ? <StatusBadge status={profile.status} /> : null}
      </header>

      {profile?.status === "APPROVED" ? (
        <>
          <Alert tone="success" title="Your store is approved">
            Products you publish after review appear in the marketplace immediately. Stripe payouts
            require a completed Connect onboarding.
          </Alert>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardBody className="space-y-1">
                <p className="subtle text-[11px] uppercase tracking-[0.04em]">Store</p>
                <p className="text-[13px] font-medium">{profile.storeName}</p>
                <Link
                  href={`/seller/${profile.slug}`}
                  className="text-[12px] text-accent hover:underline"
                >
                  /seller/{profile.slug}
                </Link>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1">
                <p className="subtle text-[11px] uppercase tracking-[0.04em]">Payout account</p>
                <p className="flex items-center gap-1.5 text-[13px] font-medium">
                  {profile.stripePayoutsEnabled ? (
                    <>
                      <BadgeCheck className="size-4 text-positive" aria-hidden />
                      Ready
                    </>
                  ) : profile.stripeDetailsSubmitted ? (
                    <>
                      <Clock className="size-4 text-caution" aria-hidden />
                      Verifying
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4 text-caution" aria-hidden />
                      Not connected
                    </>
                  )}
                </p>
                <p className="subtle text-[11.5px]">
                  {profile.stripePayoutsEnabled
                    ? "Stripe can send your earnings."
                    : "Finish onboarding in the dashboard to receive payouts."}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1">
                <p className="subtle text-[11px] uppercase tracking-[0.04em]">Next step</p>
                <Link href="/dashboard" className={buttonClass("primary", "sm")}>
                  <LayoutDashboard className="size-3.5" aria-hidden />
                  Open seller dashboard
                </Link>
              </CardBody>
            </Card>
          </div>
        </>
      ) : null}

      {profile?.status === "PENDING" ? (
        <Alert tone="warning" title="Application under review">
          We review new stores manually to keep the catalogue trustworthy. You will be notified once
          a decision is made. You can prepare product files in the meantime.
        </Alert>
      ) : null}

      {profile?.status === "SUSPENDED" ? (
        <Alert tone="error" title="Store suspended">
          Selling is disabled for this store. Contact support to resolve it.
        </Alert>
      ) : null}

      {profile?.status === "REJECTED" ? (
        <Alert tone="error" title="Application not approved">
          {profile.reviewNote ?? "No reason was recorded."} You can update the details below and
          re-apply.
        </Alert>
      ) : null}

      {profile?.status === "APPROVED" ? (
        <Card>
          <CardHeader
            title="Store profile"
            description="This is what buyers see on your store page."
          />
          <CardBody>
            <SellerApplicationForm
              action={updateSellerProfileAction}
              defaults={defaults}
              submitLabel="Save store profile"
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={profile ? "Update and re-apply" : "Apply to become a seller"}
            description={
              profile
                ? "Adjust the details and send the application back to the review team."
                : "Tell us what you build. Applications are reviewed by a human."
            }
          />
          <CardBody className="space-y-4">
            <div className="grid gap-2 text-[12.5px] text-ink-muted sm:grid-cols-3">
              <p className="flex gap-2">
                <Store className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                A public store page with your catalogue and reviews.
              </p>
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                Private file storage with expiring download links.
              </p>
              <p className="flex gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                {sellerSharePercent}% of each sale after commission, paid via Stripe.
              </p>
            </div>

            {user.emailVerified ? (
              <SellerApplicationForm
                action={applyAsSellerAction}
                defaults={defaults}
                submitLabel={profile ? "Resubmit application" : "Submit application"}
              />
            ) : (
              <Alert tone="warning" title="Verify your email first">
                Confirm your email address from the link we sent you, then reload this page to apply.
              </Alert>
            )}
          </CardBody>
        </Card>
      )}

      {profile?.status === "REJECTED" ? (
        <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          <XCircle className="size-3.5" aria-hidden />
          Repeatedly rejected applications may be restricted. Contact support if you need guidance.
        </p>
      ) : null}
    </div>
  );
}
