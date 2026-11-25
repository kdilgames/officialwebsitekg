import Link from "next/link";
import { Lock, Shield } from "lucide-react";

import { MfaManager } from "@/components/account/mfa-manager";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Security & 2FA",
  description: "Protect your KDILGAMES account with Two-Factor Authentication (TOTP).",
};

export default async function AccountSecurityPage() {
  const user = await requireUser("/account/security");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <Shield className="size-4 text-accent" aria-hidden />
          Security &amp; 2FA
        </h1>
        <p className="muted mt-1 text-[12.5px]">
          Secure your account ({user.email}) with an authenticator app and strong password hygiene.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Two-Factor Authentication (2FA)"
          description="Require a 6-digit TOTP verification code in addition to your password."
        />
        <CardBody>
          <MfaManager supabaseConfigured={isSupabaseConfigured} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Password"
          description="Change your password regularly, especially if you operate a seller store."
        />
        <CardBody>
          <Link href="/account/password" className={buttonClass("secondary", "sm")}>
            <Lock className="size-3.5" aria-hidden />
            Change password
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
