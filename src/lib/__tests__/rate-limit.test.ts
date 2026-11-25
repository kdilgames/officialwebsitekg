import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockRejectedValue(new Error("relation RateLimitBucket does not exist")),
    rateLimitBucket: {
      deleteMany: vi.fn().mockRejectedValue(new Error("relation RateLimitBucket does not exist")),
    },
  },
}));

import { extractClientIp, purgeExpiredRateLimits, rateLimit } from "../rate-limit";

describe("extractClientIp", () => {
  const makeHeaders = (entries: Record<string, string>) => ({
    get(name: string) {
      return entries[name.toLowerCase()] ?? null;
    },
  });

  it("prefers cf-connecting-ip over forwarded headers", () => {
    const ip = extractClientIp(
      makeHeaders({
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
        "x-real-ip": "192.0.2.1",
      }),
    );
    expect(ip).toBe("203.0.113.10");
  });

  it("extracts the first IP from x-forwarded-for", () => {
    const ip = extractClientIp(
      makeHeaders({
        "x-forwarded-for": " 198.51.100.42 , 10.0.0.1 ",
      }),
    );
    expect(ip).toBe("198.51.100.42");
  });

  it("falls back to x-real-ip and returns null when empty", () => {
    expect(extractClientIp(makeHeaders({ "x-real-ip": "192.0.2.99" }))).toBe("192.0.2.99");
    expect(extractClientIp(makeHeaders({}))).toBeNull();
  });

  it("truncates overly long values safely", () => {
    const longIp = "a".repeat(120);
    expect(extractClientIp(makeHeaders({ "x-real-ip": longIp }))?.length).toBe(64);
  });
});

describe("rateLimit fail-open behaviour", () => {
  it("fails open when database throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await rateLimit("test:key", 5, 60);
    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.limit).toBe(5);
    const purged = await purgeExpiredRateLimits();
    expect(purged).toBe(0);
    warnSpy.mockRestore();
  });
});
