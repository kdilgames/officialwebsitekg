import { Prisma } from "@prisma/client";

const MISSING_SCHEMA_CODES = new Set([
  "P2021", // Prisma: Table does not exist in the current database
  "P2022", // Prisma: Column does not exist in the current database
  "42P01", // Postgres: undefined_table
  "42703", // Postgres: undefined_column
]);

/**
 * Detects Prisma / PostgreSQL errors caused by querying tables or columns
 * whose migration (`prisma migrate deploy`) has not yet run on the target database.
 *
 * Connection errors (ECONNREFUSED, auth failures, timeouts) return false so real
 * database outages are never masked.
 */
export function isMissingSchemaError(error: unknown, depth = 0): boolean {
  if (depth > 6 || !error || typeof error !== "object") return false;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (MISSING_SCHEMA_CODES.has(error.code)) return true;
  }

  const record = error as {
    code?: unknown;
    originalCode?: unknown;
    message?: unknown;
    originalMessage?: unknown;
    cause?: unknown;
    meta?: unknown;
    driverAdapterError?: unknown;
  };

  for (const codeCandidate of [record.code, record.originalCode]) {
    if (typeof codeCandidate === "string" && MISSING_SCHEMA_CODES.has(codeCandidate)) {
      return true;
    }
  }

  for (const messageCandidate of [record.message, record.originalMessage]) {
    if (
      typeof messageCandidate === "string" &&
      /(?:relation|column|table|type)\s+.*does not exist/i.test(messageCandidate)
    ) {
      return true;
    }
  }

  for (const nested of [record.cause, record.meta, record.driverAdapterError]) {
    if (nested && isMissingSchemaError(nested, depth + 1)) {
      return true;
    }
  }

  return false;
}

/**
 * Executes a Prisma operation and falls back cleanly when the deployed database
 * schema has not yet run the latest migration.
 */
export async function withSchemaFallback<T>(
  query: () => Promise<T>,
  fallback: T | (() => Promise<T>),
): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return typeof fallback === "function" ? await (fallback as () => Promise<T>)() : fallback;
    }
    throw error;
  }
}
