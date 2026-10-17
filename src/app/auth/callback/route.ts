import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/utils/next";

/**
 * Handles the links Supabase Auth sends out: email confirmation and password
 * recovery. The one-time code is exchanged for a session cookie server-side, so
 * the token never has to be trusted from the browser.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const isRecovery = type === "recovery";
  const next = safeNext(url.searchParams.get("next"), isRecovery ? "/account/password" : "/account");

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(new URL(isRecovery ? "/forgot-password?error=link" : "/login?error=link", url.origin));
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
    return NextResponse.redirect(new URL(isRecovery ? "/forgot-password?error=link" : "/login?error=link", url.origin));
  }

  if (error) {
    return NextResponse.redirect(
      new URL(isRecovery ? "/forgot-password?error=link" : "/login?error=link", url.origin),
    );
  }

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await prisma.user.updateMany({
      where: { authUserId: data.user.id },
      data: { emailVerified: true },
    });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

function isOtpType(value: string | null): value is EmailOtpType {
  return value === "signup" || value === "invite" || value === "magiclink" || value === "recovery" || value === "email_change" || value === "email";
}
