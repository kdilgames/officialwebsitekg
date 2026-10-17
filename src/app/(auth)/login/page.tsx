import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";
import { signInAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/utils/next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(safeNext(params.next));

  return (
    <div>
      <h1 className="text-[18px] font-semibold tracking-tight">Sign in</h1>
      <p className="muted mt-1 text-[12.5px]">
        Access your purchases, downloads and seller dashboard.
      </p>

      {!isSupabaseConfigured ? (
        <Alert tone="error" className="mt-4" title="Authentication is not configured">
          Supabase Auth credentials are missing from this deployment. Run{" "}
          <code>stripe projects env --pull</code> and restart the server.
        </Alert>
      ) : null}

      <div className="mt-5">
        <LoginForm action={signInAction} next={params.next} />
      </div>
    </div>
  );
}
