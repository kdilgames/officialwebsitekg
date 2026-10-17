/**
 * Environment configuration.
 *
 * Values are validated lazily so that the application can still build and boot
 * for local development before every provider has been provisioned. Any feature
 * whose credentials are missing is explicitly disabled rather than faked.
 */

function optional(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(optional(value) ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Supabase ships its connection URLs with the documentation placeholder
 * `[YOUR-PASSWORD]` in the password slot when the resource is created through
 * the Stripe Projects CLI; the real password is exposed as `SUPABASE_DB_PASS`.
 * Both URLs are also IPv6-only on the direct host, so the pooler is preferred.
 *
 * `uselibpqcompat=true` restores libpq semantics for `sslmode=require`
 * (encrypt but do not verify the CA chain), which is what Supabase's pooler
 * requires: its certificate chain is rooted in a private CA.
 */
function resolveDatabaseUrl(): string | undefined {
  const explicit = optional(process.env.DATABASE_URL) ?? optional(process.env.DIRECT_URL);
  if (explicit && !explicit.includes("[YOUR-PASSWORD]")) return explicit;

  const raw =
    optional(process.env.SUPABASE_POOLER_URL) ?? optional(process.env.SUPABASE_DB_URL);
  if (!raw) return undefined;

  const password = optional(process.env.SUPABASE_DB_PASS);
  const url = new URL(raw.includes("[YOUR-PASSWORD]") ? raw.replace("[YOUR-PASSWORD]", "") : raw);
  if (password) url.password = password;
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  siteUrl:
    optional(process.env.SITE_URL) ??
    optional(process.env.NEXT_PUBLIC_SITE_URL) ??
    "http://localhost:3000",

  database: {
    // Derived from the pooler URL plus SUPABASE_DB_PASS; see resolveDatabaseUrl.
    url: resolveDatabaseUrl(),
    directUrl: resolveDatabaseUrl(),
  },

  supabase: {
    url:
      optional(process.env.NEXT_PUBLIC_SUPABASE_URL) ??
      optional(process.env.SUPABASE_PROJECT_URL),
    anonKey:
      optional(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
      optional(process.env.SUPABASE_PUBLISHABLE_KEY),
    // Optional: when absent every storage call runs with the signed-in user's
    // session and is authorised by Postgres RLS policies on storage.objects.
    serviceRoleKey: optional(process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  stripe: {
    secretKey: optional(process.env.STRIPE_SECRET_KEY),
    publishableKey: optional(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    webhookSecret: optional(process.env.STRIPE_WEBHOOK_SECRET),
  },

  marketplace: {
    defaultCommissionBps: positiveInt(process.env.PLATFORM_COMMISSION_BPS, 1500),
    earningsHoldDays: positiveInt(process.env.EARNINGS_HOLD_DAYS, 7),
    platformName: "KDILGAMES",
  },

  cronSecret: optional(process.env.CRON_SECRET),

  malwareScanner: {
    virusTotalApiKey: optional(process.env.VIRUSTOTAL_API_KEY),
  },

  uploads: {
    maxFileBytes: 512 * 1024 * 1024,
    maxImageBytes: 8 * 1024 * 1024,
    maxAvatarBytes: 2 * 1024 * 1024,
    maxImagesPerProduct: 8,
    productFileBucket: "product-files",
    productImageBucket: "product-images",
    avatarBucket: "avatars",
  },
} as const;

export const isDatabaseConfigured = Boolean(env.database.url);
/**
 * Storage and auth use the publishable key together with RLS policies, so a
 * service-role key is not required. `isSupabaseAdminConfigured` only controls
 * optional elevated operations.
 */
export const isSupabaseConfigured = Boolean(env.supabase.url && env.supabase.anonKey);
export const isSupabaseAdminConfigured = Boolean(
  env.supabase.url && env.supabase.serviceRoleKey,
);
export const isStripeConfigured = Boolean(env.stripe.secretKey);
export const isScannerConfigured = Boolean(env.malwareScanner.virusTotalApiKey);

/**
 * Throws a descriptive error when a required configuration block is missing.
 * Call this at the top of any code path that genuinely needs the provider.
 */
export function requireConfig(block: "database" | "supabase" | "stripe"): void {
  const missing: string[] = [];
  if (block === "database" && !env.database.url) missing.push("DATABASE_URL");
  if (block === "supabase") {
    if (!env.supabase.url) missing.push("SUPABASE_PROJECT_URL");
    if (!env.supabase.anonKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  }
  if (block === "stripe") {
    if (!env.stripe.secretKey) missing.push("STRIPE_SECRET_KEY");
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing configuration for "${block}": ${missing.join(", ")}. ` +
        `Provision the service with the Stripe Projects CLI and run \`stripe projects env --pull\`.`,
    );
  }
}
