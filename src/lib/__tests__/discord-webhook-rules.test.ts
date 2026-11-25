import { describe, expect, it } from "vitest";

import {
  buildProductReleaseDiscordPayload,
  isValidDiscordWebhookUrl,
  maskDiscordWebhookUrl,
  parseDiscordWebhookUrl,
} from "../discord-webhook-rules";

describe("parseDiscordWebhookUrl", () => {
  it("accepts valid official Discord webhook URLs and preserves valid thread_id", () => {
    const valid =
      "https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789_-";
    expect(parseDiscordWebhookUrl(valid)).toBe(valid);
    expect(
      parseDiscordWebhookUrl(
        `https://ptb.discord.com/api/v10/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789_-?thread_id=987654321098765432&wait=true#frag`,
      ),
    ).toBe(
      "https://ptb.discord.com/api/v10/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789_-?thread_id=987654321098765432",
    );
  });

  it("rejects non-HTTPS, non-Discord hosts, and SSRF targets", () => {
    expect(
      isValidDiscordWebhookUrl(
        "http://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789",
      ),
    ).toBe(false);
    expect(
      isValidDiscordWebhookUrl(
        "https://localhost/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789",
      ),
    ).toBe(false);
    expect(
      isValidDiscordWebhookUrl(
        "https://169.254.169.254/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789",
      ),
    ).toBe(false);
    expect(isValidDiscordWebhookUrl("https://discord.gg/abc123")).toBe(false);
    expect(isValidDiscordWebhookUrl("https://evil.com/discord.com/api/webhooks/123/abc")).toBe(
      false,
    );
  });
});

describe("maskDiscordWebhookUrl", () => {
  it("redacts the webhook secret token", () => {
    const masked = maskDiscordWebhookUrl(
      "https://discord.com/api/webhooks/1234567890123456789/secretTokenValue1234567890",
    );
    expect(masked).toContain("1234567890123456789");
    expect(masked).not.toContain("secretTokenValue1234567890");
    expect(masked).toContain("secr…7890");
  });
});

describe("buildProductReleaseDiscordPayload", () => {
  it("builds a clean embed with disabled @everyone/@here mentions and safe HTTPS thumbnail", () => {
    const payload = buildProductReleaseDiscordPayload({
      platformName: "KDILGAMES",
      siteOrigin: "https://kdilgames.example/",
      product: {
        title: "Combat System v2",
        slug: "combat-system-v2",
        shortDescription: "Modular combat toolkit for Roblox games.",
        priceLabel: "€19.99",
        categoryName: "Roblox Systems",
        storeName: "KdilStudio",
        version: "2.0.0",
        thumbnailUrl: "https://cdn.example.com/thumb.png",
      },
    });

    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds[0]?.url).toBe("https://kdilgames.example/product/combat-system-v2");
    expect(payload.embeds[0]?.thumbnail).toEqual({ url: "https://cdn.example.com/thumb.png" });
    expect(payload.embeds[0]?.fields.map((f) => `${f.name}:${f.value}`)).toEqual([
      "Price:€19.99",
      "Category:Roblox Systems",
      "Creator:KdilStudio",
      "Version:v2.0.0",
    ]);
  });

  it("drops non-HTTPS thumbnail URLs", () => {
    const payload = buildProductReleaseDiscordPayload({
      platformName: "KDILGAMES",
      siteOrigin: "https://kdilgames.example",
      product: {
        title: "Starter Pack",
        slug: "starter-pack",
        shortDescription: "Starter kit.",
        priceLabel: "Free",
        categoryName: "Templates",
        storeName: "KdilStudio",
        version: "1.0.0",
        thumbnailUrl: "http://insecure.example.com/img.png",
      },
    });

    expect(payload.embeds[0]?.thumbnail).toBeUndefined();
  });
});
