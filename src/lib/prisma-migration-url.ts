function cleanEnv(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalizes a PostgreSQL connection URL for Prisma Migrate CLI operations.
 *
 * Prisma Migrate acquires PostgreSQL advisory locks (`pg_advisory_lock`), which
 * hang indefinitely on Supabase's transaction pooler (port `6543`,
 * `pgbouncer=true`). Supabase's session pooler uses the exact same hostname and
 * credentials on port `5432`, so transaction-pooler URLs are automatically
 * pinned to port `5432` for migrations while runtime traffic continues to use
 * `DATABASE_URL` untouched.
 */
export function normalizeSupabaseMigrationUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const isSupabasePooler = url.hostname.toLowerCase().endsWith(".pooler.supabase.com");
    if (isSupabasePooler && (url.port === "6543" || url.searchParams.get("pgbouncer") === "true")) {
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
      if (!url.searchParams.has("sslmode")) {
        url.searchParams.set("sslmode", "require");
      }
      return url.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

export function resolvePrismaMigrationUrl(
  source: Record<string, string | undefined>,
): string | undefined {
  const direct = cleanEnv(source.DIRECT_URL);
  if (direct && !direct.includes("[YOUR-PASSWORD]")) {
    return normalizeSupabaseMigrationUrl(direct);
  }

  const database = cleanEnv(source.DATABASE_URL);
  if (database && !database.includes("[YOUR-PASSWORD]")) {
    return normalizeSupabaseMigrationUrl(database);
  }

  const pooler = cleanEnv(source.SUPABASE_POOLER_URL);
  const password = cleanEnv(source.SUPABASE_DB_PASS);
  if (!pooler || !password) return cleanEnv(source.SUPABASE_DB_URL);

  try {
    const url = new URL(
      pooler.includes("[YOUR-PASSWORD]") ? pooler.replace("[YOUR-PASSWORD]", "") : pooler,
    );
    url.password = password;
    url.port = "5432";
    url.searchParams.delete("pgbouncer");
    url.searchParams.set("sslmode", "require");
    return url.toString();
  } catch {
    return cleanEnv(source.SUPABASE_DB_URL);
  }
}
