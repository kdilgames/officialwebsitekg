"use client";

import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

let cached: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Browser Supabase client. Only ever holds the publishable key; privileged
 * work happens in Server Actions and Route Handlers.
 */
export function createSupabaseBrowserClient() {
  if (cached) return cached;

  if (!env.supabase.url || !env.supabase.anonKey) {
    throw new Error(
      "Supabase is not configured. Run `stripe projects env --pull` to refresh .env.",
    );
  }

  cached = createBrowserClient(env.supabase.url, env.supabase.anonKey);
  return cached;
}
