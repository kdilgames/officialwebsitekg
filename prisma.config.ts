import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// The Prisma CLI does not read .env files on its own (Next.js does).
// `prisma.config.ts` is evaluated first, so load the local environment here.
const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

/**
 * Resolves the connection string used by the Prisma CLI.
 *
 * Notes about the Supabase resource provisioned through the Stripe Projects CLI:
 * - `SUPABASE_POOLER_URL` is delivered with Supabase's documentation placeholder
 *   `[YOUR-PASSWORD]` in the password slot; the actual password is exposed
 *   separately as `SUPABASE_DB_PASS`, so the placeholder is replaced here.
 * - `SUPABASE_DB_URL` points at `db.<ref>.supabase.co`, which is IPv6-only and
 *   does not resolve on every network, so it is only a last-resort fallback.
 * - Prisma Migrate takes advisory locks, which the transaction pooler cannot
 *   hold, so the URL is pinned to the session pooler (port 5432).
 */
function resolveDatabaseUrl(): string | undefined {
  const explicit = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (explicit) return explicit;

  const pooler = process.env.SUPABASE_POOLER_URL;
  const password = process.env.SUPABASE_DB_PASS;
  if (!pooler || !password) return process.env.SUPABASE_DB_URL;

  const url = new URL(pooler);
  url.password = password;
  url.port = "5432";
  url.searchParams.set("sslmode", "require");
  return url.toString();
}

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Seeds the six marketplace categories and the policy documents. Existing
    // rows are never overwritten, so it is safe to re-run after go-live.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations require a real DATABASE_URL; if it is absent the command fails
    // with a connection error, which is the intended behaviour.
    //
    // No shadowDatabaseUrl is configured on purpose: pointing Prisma's shadow
    // database at the Supabase project itself would let `migrate dev` reset live
    // data. Generate migrations with `npm run db:diff` and apply with `db:deploy`.
    url: databaseUrl ?? "postgresql://unset:unset@localhost:5432/unset",
  },
});
