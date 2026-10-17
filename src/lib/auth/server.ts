import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env, requireConfig } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * The publishable (anon) key is safe to expose: every `public` table has RLS
 * enabled and PostgREST access revoked, so this client can only reach Supabase
 * Auth and the storage buckets governed by the policies in
 * `prisma/migrations/*_supabase_auth_and_storage`.
 */
export async function createSupabaseServerClient() {
  requireConfig("supabase");
  const cookieStore = await cookies();

  return createServerClient(env.supabase.url as string, env.supabase.anonKey as string, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Session refresh is handled by
          // `src/proxy.ts`, so this can be safely ignored.
        }
      },
    },
  });
}
