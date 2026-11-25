import { describe, expect, it } from "vitest";

import { resolveOriginFromHeaders } from "../origin-rules";

describe("resolveOriginFromHeaders", () => {
  it("prefers x-forwarded-host and x-forwarded-proto on deployed domains", () => {
    expect(
      resolveOriginFromHeaders({
        forwardedHost: "kdilgames.com, proxy.internal",
        host: "localhost:3000",
        forwardedProto: "https, http",
        fallbackOrigin: "http://localhost:3000",
      }),
    ).toBe("https://kdilgames.com");
  });

  it("defaults to https for public host headers when proto header is absent", () => {
    expect(
      resolveOriginFromHeaders({
        host: "shop.kdilgames.gg",
        fallbackOrigin: "http://localhost:3000",
      }),
    ).toBe("https://shop.kdilgames.gg");
  });

  it("keeps http for localhost when proto header is absent", () => {
    expect(
      resolveOriginFromHeaders({
        host: "localhost:3000",
        fallbackOrigin: "http://localhost:3000",
      }),
    ).toBe("http://localhost:3000");
  });

  it("prefers public HTTPS fallback over internal loopback host headers", () => {
    expect(
      resolveOriginFromHeaders({
        host: "0.0.0.0:3000",
        fallbackOrigin: "https://kdilgames.com",
      }),
    ).toBe("https://kdilgames.com");
  });

  it("rejects malformed host headers and uses fallback", () => {
    expect(
      resolveOriginFromHeaders({
        forwardedHost: "evil.com/path?x=1",
        host: "bad host",
        fallbackOrigin: "https://kdilgames.com",
      }),
    ).toBe("https://kdilgames.com");
  });
});
