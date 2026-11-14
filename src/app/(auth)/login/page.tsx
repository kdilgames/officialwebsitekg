import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";
import { sendMagicLinkAction, signInAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/utils/next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) {
    const fallback = user.role === "ADMIN" ? "/admin" : "/account";
    redirect(params.next ? safeNext(params.next, fallback) : fallback);
  }

  const isAdminDestination = Boolean(params.next && params.next.startsWith("/admin"));

  return (
    <div>
      <h1 className="text-[20px] font-bold tracking-tight">
        {isAdminDestination ? "Admin & owner sign in" : "Sign in"}
      </h1>
      <p className="muted mt-1.5 text-[13px]">
        {isAdminDestination
          ? "Sign in with your authorized email using your password or a one-click email link."
          : "Access your purchases, downloads, seller dashboard, or staff administration."}
      </p>

      {isAdminDestination ? (
        <div className="mt-4 flex items-center gap-2 rounded-[9px] border border-accent/25 bg-accent-quiet px-3.5 py-2.5 text-[12.5px] text-accent-ink">
          <ShieldCheck className="size-4 shrink-0 text-accent" aria-hidden />
          <span>
            Restricted area: verified owner and allowlisted staff emails are recognized
            automatically.
          </span>
        </div>
      ) : null}

      {params.error === "link" ? (
        <Alert tone="warning" className="mt-4" title="Sign-in link expired or invalid">
          Request a fresh verification or sign-in link below.
        </Alert>
      ) : null}

      {params.error === "suspended" ? (
        <Alert tone="error" className="mt-4" title="Account unavailable">
          This account has been suspended or closed. Contact support for help.
        </Alert>
      ) : null}

      {!isSupabaseConfigured ? (
        <Alert tone="error" className="mt-4" title="Authentication is not configured">
          Supabase Auth credentials are missing from this deployment. Run{" "}
          <code>stripe projects env --pull</code> and restart the server.
        </Alert>
      ) : null}

      <div className="mt-5">
        <LoginForm
          action={signInAction}
          magicLinkAction={sendMagicLinkAction}
          next={params.next}
        />
      </div>
    </div>
  );
}

