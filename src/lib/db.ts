import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

/**
 * Prisma is only ever used from the server: it connects with the database owner
 * role and therefore bypasses the Supabase RLS policies that protect the tables
 * from the public PostgREST API. Never import this module into client code.
 */
function createPrismaClient(): PrismaClient {
  if (!env.database.url) {
    throw new Error(
      "Database is not configured. Provision Postgres and run `stripe projects env --pull`.",
    );
  }

  const adapter = new PrismaPg({ connectionString: env.database.url });

  return new PrismaClient({
    adapter,
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}
