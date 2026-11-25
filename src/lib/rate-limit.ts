import { prisma } from "./db";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  degraded?: boolean;
};

type HeaderReader = {
  get(name: string): string | null;
};

/**
 * Extracts the best client IP address from standard proxy / CDN headers
 * (Cloudflare, Vercel, nginx). Returns null when unavailable.
 */
export function extractClientIp(headerList: HeaderReader): string | null {
  const candidates = [
    headerList.get("cf-connecting-ip"),
    headerList.get("x-forwarded-for")?.split(",")[0],
    headerList.get("x-real-ip"),
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed.slice(0, 64);
    }
  }

  return null;
}

/**
 * Fixed-window rate limiter backed by Postgres so the marketplace needs no
 * additional infrastructure. The increment and the window reset happen in a
 * single statement, which keeps concurrent requests from racing.
 *
 * Fails open with a logged warning if the bucket table does not exist yet
 * (pre-migration deploy) or if the database hits a transient error, so core
 * routes never 500 purely because rate-limit storage is unavailable.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
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
  } catch (error) {
    console.warn("[rate-limit] storage unavailable; failing open:", error);
    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      limit,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
      degraded: true,
    };
  }
}

/** Best-effort housekeeping; safe to call from a cron route. */
export async function purgeExpiredRateLimits(): Promise<number> {
  try {
    const result = await prisma.rateLimitBucket.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    return result.count;
  } catch (error) {
    console.warn("[rate-limit] failed to purge expired buckets:", error);
    return 0;
  }
}
