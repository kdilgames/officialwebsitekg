import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";
import { signUpAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/account");

  return (
    <div>
      <h1 className="text-[20px] font-bold tracking-tight">Create your account</h1>
      <p className="muted mt-1.5 text-[13px] leading-relaxed">
        Join KDILGAMES to buy digital products, access downloads anytime, or open a creator store.
      </p>

      {!isSupabaseConfigured ? (
        <Alert tone="error" className="mt-4" title="Authentication is not configured">
          Supabase Auth credentials are missing from this deployment. Run{" "}
          <code>stripe projects env --pull</code> and restart the server.
        </Alert>
      ) : null}

      <div className="mt-5">
        <RegisterForm action={signUpAction} />
      </div>
    </div>
  );
}
