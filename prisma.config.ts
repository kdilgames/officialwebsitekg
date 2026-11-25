import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

import { resolvePrismaMigrationUrl } from "./src/lib/prisma-migration-url";

// The Prisma CLI does not read .env files on its own (Next.js does).
// `prisma.config.ts` is evaluated first, so load the local environment here.
const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const databaseUrl = resolvePrismaMigrationUrl(process.env);

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
