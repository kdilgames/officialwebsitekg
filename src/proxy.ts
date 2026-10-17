import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on every request so Server Components
 * always see a valid token, and adds baseline security headers.
 *
 * `proxy` is the Next.js 16 name for the middleware convention.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Touching the user forces the refresh; the result is not used here.
    await supabase.auth.getUser();
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
