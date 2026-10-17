import Link from "next/link";

import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { resetPasswordAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set a new password" };

/**
 * Landing page for the link in a password-reset email. The `/auth/callback`
 * route has already exchanged the code for a session, so the form only sets a
 * new password on that authenticated session.
 */
export default async function AccountPasswordPage() {
  const user = await requireUser("/account/password");

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader
          title="Set a new password"
          description={`Signed in as ${user.email}. Pick something you have not used here before.`}
        />
        <CardBody>
          <ResetPasswordForm action={resetPasswordAction} />
          <p className="muted mt-3 text-center text-[12px]">
            Prefer to change it from inside your account?{" "}
            <Link href="/account" className="text-accent hover:underline">
              Go to account settings
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
