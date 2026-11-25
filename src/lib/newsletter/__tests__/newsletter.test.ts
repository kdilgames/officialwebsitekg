import { describe, expect, it } from "vitest";

import {
  generateUnsubscribeToken,
  newsletterSubscribeSchema,
  normalizeNewsletterEmail,
} from "../rules";
import { getStudioGameBySlug, listStudioGames } from "../../studios/apps";

describe("Newsletter rules", () => {
  it("validates and normalizes subscriber emails", () => {
    expect(normalizeNewsletterEmail("  Player@Example.COM ")).toBe("player@example.com");
    expect(newsletterSubscribeSchema.safeParse({ email: "player@example.com" }).success).toBe(true);
    expect(newsletterSubscribeSchema.safeParse({ email: "invalid-email" }).success).toBe(false);
  });

  it("generates unique 48-char hex unsubscribe tokens", () => {
    const a = generateUnsubscribeToken();
    const b = generateUnsubscribeToken();
    expect(a).toMatch(/^[a-f0-9]{48}$/);
    expect(a).not.toBe(b);
  });
});

describe("Our Games catalog", () => {
  it("lists ByteRack Tycoon and resolves it by slug", () => {
    const games = listStudioGames();
    expect(games.length).toBeGreaterThanOrEqual(1);
    const byterack = getStudioGameBySlug("byterack-tycoon");
    expect(byterack?.name).toBe("ByteRack Tycoon");
    expect(byterack?.packageName).toBe("com.kdilgames.ByteRackTycoon");
    expect(getStudioGameBySlug("nonexistent")).toBeUndefined();
  });
});
