import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { syncAuthenticatedUser } from "@/lib/auth/admin-access";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/utils/next";

/**
 * Handles the links Supabase Auth sends out: email confirmation, magic-link
 * sign-in, and password recovery. The one-time code is exchanged for a session
 * cookie server-side, so the token never has to be trusted from the browser.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const explicitNext = url.searchParams.get("next");
  const isRecovery = type === "recovery";

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(
      new URL(isRecovery ? "/forgot-password?error=link" : "/login?error=link", url.origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  let error: Error | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && isOtpType(type)) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = result.error;
  } else {
    return NextResponse.redirect(
      new URL(isRecovery ? "/forgot-password?error=link" : "/login?error=link", url.origin),
    );
  }

  if (error) {
    return NextResponse.redirect(
      new URL(isRecovery ? "/forgot-password?error=link" : "/login?error=link", url.origin),
    );
  }

  const { data } = await supabase.auth.getUser();
  let destinationFallback = isRecovery ? "/account/password" : "/account";

  if (data.user) {
    const synced = await syncAuthenticatedUser(data.user, {
      markEmailVerified: type !== "recovery",
      updateLastLogin: true,
    });
    if (!synced.user) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=suspended", url.origin));
    }
    if (!isRecovery && synced.user.role === "ADMIN") {
      destinationFallback = "/admin";
    }
  }

  const next = explicitNext ? safeNext(explicitNext, destinationFallback) : destinationFallback;
  return NextResponse.redirect(new URL(next, url.origin));
}

function isOtpType(value: string | null): value is EmailOtpType {
  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

