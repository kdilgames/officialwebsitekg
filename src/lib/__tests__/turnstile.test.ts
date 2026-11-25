import { describe, expect, it, vi } from "vitest";

import { verifyTurnstileToken } from "../turnstile";

describe("verifyTurnstileToken", () => {
  it("skips gracefully when TURNSTILE_SECRET_KEY is unset", async () => {
    const result = await verifyTurnstileToken("", null, { secretKey: "" });
    expect(result).toEqual({ ok: true, skipped: true });
  });

  it("rejects missing token when secret key is configured", async () => {
    const result = await verifyTurnstileToken("   ", "198.51.100.1", {
      secretKey: "secret-key",
    });
    expect(result.ok).toBe(false);
    expect(result.errorCodes).toContain("missing-input-response");
  });

  it("accepts a valid siteverify response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const result = await verifyTurnstileToken("valid-token", "198.51.100.5", {
      secretKey: "secret-key",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("rejects an invalid siteverify response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }),
        { status: 200 },
      ),
    );
    const result = await verifyTurnstileToken("bad-token", null, {
      secretKey: "secret-key",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.errorCodes).toContain("invalid-input-response");
  });

  it("fails open on transient network failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mockFetch = vi.fn().mockRejectedValue(new Error("timeout"));
    const result = await verifyTurnstileToken("some-token", null, {
      secretKey: "secret-key",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    warnSpy.mockRestore();
  });
});
