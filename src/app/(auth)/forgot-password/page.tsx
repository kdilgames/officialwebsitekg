import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/forms/auth-forms";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-[18px] font-semibold tracking-tight">Reset your password</h1>
      <p className="muted mt-1 text-[12.5px]">
        Enter the email on your account and we will send a single-use reset link.
      </p>
      <div className="mt-5">
        <ForgotPasswordForm action={requestPasswordResetAction} />
      </div>
    </div>
  );
}
