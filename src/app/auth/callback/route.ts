import { NextResponse, type NextRequest } from "next/server";

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
  const next = safeNext(url.searchParams.get("next"), "/account");

  if (!isSupabaseConfigured || !code) {
    return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=link", url.origin));
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
