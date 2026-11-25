import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { DeleteAccountForm, GdprExportCard } from "@/components/account/gdpr-controls";
import { CookiePreferencesButton } from "@/components/layout/cookie-banner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { deleteAccountAction } from "@/lib/account/gdpr-actions";
import { isOwner, requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Privacy & GDPR data",
  description: "Manage cookie consent, export your personal data, or delete your account.",
};

export default async function AccountPrivacyPage() {
  const user = await requireUser("/account/privacy");
  const ownerAccount = isOwner(user);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <ShieldCheck className="size-4 text-accent" aria-hidden />
          Privacy &amp; GDPR data
        </h1>
        <p className="muted mt-1 text-[12.5px]">
          Exercise your EU General Data Protection Regulation rights directly from your account.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Cookie preferences"
          description="Control optional preference and analytics cookies at any time."
        />
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="muted text-[13px]">
            Review our{" "}
            <Link href="/legal/cookies" className="text-accent hover:underline">
              Cookie Policy
            </Link>{" "}
            or reopen the consent banner to change your choices.
          </p>
          <span className="btn btn-secondary btn-sm">
            <CookiePreferencesButton />
          </span>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Export your personal data"
          description="Right to data portability (GDPR Article 20)."
        />
        <CardBody>
          <GdprExportCard />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Delete account"
          description="Right to erasure (GDPR Article 17). This action cannot be undone."
        />
        <CardBody>
          <DeleteAccountForm
            action={deleteAccountAction}
            email={user.email}
            isOwnerAccount={ownerAccount}
          />
        </CardBody>
      </Card>
    </div>
  );
}
