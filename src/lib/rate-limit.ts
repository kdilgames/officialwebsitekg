import { prisma } from "@/lib/db";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
};

/**
 * Fixed-window rate limiter backed by Postgres so the marketplace needs no
 * additional infrastructure. The increment and the window reset happen in a
 * single statement, which keeps concurrent requests from racing.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, now(), now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."expiresAt" < now() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."expiresAt" < now() THEN now()
        ELSE "RateLimitBucket"."windowStart"
      END,
      "expiresAt" = CASE
        WHEN "RateLimitBucket"."expiresAt" < now()
          THEN now() + make_interval(secs => ${windowSeconds})
        ELSE "RateLimitBucket"."expiresAt"
      END
    RETURNING "count", "expiresAt"
  `;

  const row = rows[0];
  if (!row) return { ok: true, remaining: limit - 1, limit, resetAt: new Date() };

  return {
    ok: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    limit,
    resetAt: row.expiresAt,
  };
}

/** Best-effort housekeeping; safe to call from a cron route. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  return result.count;
}
