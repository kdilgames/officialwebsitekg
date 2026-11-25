import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  AFFILIATE_COOKIE_MAX_AGE_SECONDS,
  AFFILIATE_COOKIE_NAME,
  normalizeAffiliateCode,
} from "@/lib/affiliate/rules";
import { env, isSupabaseConfigured } from "@/lib/env";
import {
  LOCALE_COOKIE_NAME,
  parseLocale,
  resolveLocaleFromAcceptLanguage,
} from "@/lib/i18n/config";

/**
 * Refreshes the Supabase session cookie on every request so Server Components
 * always see a valid token, captures affiliate referral codes, negotiates
 * HR/EN locale without altering URLs, and adds baseline security headers.
 *
 * `proxy` is the Next.js 16 name for the middleware convention.
 */
export async function proxy(request: NextRequest) {
  const cookieLocale = parseLocale(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
  const resolvedLocale =
    cookieLocale ?? resolveLocaleFromAcceptLanguage(request.headers.get("accept-language"));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-kdil-locale", resolvedLocale);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  if (isSupabaseConfigured) {
    const supabase = createServerClient(env.supabase.url as string, env.supabase.anonKey as string, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Touching the user forces the refresh; the result is not used here.
    await supabase.auth.getUser();
  }

  const refParam = request.nextUrl.searchParams.get("ref");
  if (refParam) {
    const normalized = normalizeAffiliateCode(refParam);
    if (normalized) {
      response.cookies.set(AFFILIATE_COOKIE_NAME, normalized, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: AFFILIATE_COOKIE_MAX_AGE_SECONDS,
      });
    }
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
