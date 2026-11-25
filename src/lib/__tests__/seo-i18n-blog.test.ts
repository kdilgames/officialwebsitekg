import { describe, expect, it } from "vitest";

import { getBlogPostBySlug, getLocalizedBlogPost, listBlogPosts } from "../blog/posts";
import { parseLocale, resolveLocaleFromAcceptLanguage } from "../i18n/config";
import { getDictionary } from "../i18n/dictionaries";
import {
  buildBlogPostJsonLd,
  buildGameJsonLd,
  buildProductJsonLd,
  serializeJsonLd,
} from "../seo/json-ld";

describe("JSON-LD builders", () => {
  it("builds valid schema.org Product JSON-LD with aggregateRating and safe serialization", () => {
    const schema = buildProductJsonLd({
      siteUrl: "https://kdilgames.com/",
      slug: "dungeon-kit",
      title: "Dungeon Kit </script><script>",
      shortDescription: "Modular Roblox dungeon generator",
      imageUrls: ["https://kdilgames.com/img.png"],
      categoryName: "Roblox",
      sellerName: "PixelForge",
      sellerSlug: "pixelforge",
      priceMinor: 2500,
      salePriceMinor: 1999,
      saleEndsAt: new Date("2099-12-31T23:59:59Z"),
      currency: "EUR",
      version: "2.0.0",
      ratingSum: 48,
      ratingCount: 10,
    });

    expect(schema["@type"]).toBe("Product");
    expect((schema.offers as Record<string, unknown>).price).toBe("19.99");
    expect((schema.aggregateRating as Record<string, unknown>).ratingValue).toBe(4.8);

    const serialized = serializeJsonLd(schema);
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
  });

  it("omits aggregateRating when there are zero reviews and builds VideoGame & BlogPosting schemas", () => {
    const prod = buildProductJsonLd({
      siteUrl: "https://kdilgames.com",
      slug: "free-tool",
      title: "Free Tool",
      shortDescription: "Helpful CLI",
      imageUrls: [],
      categoryName: "Dev Tools",
      sellerName: "KDIL",
      sellerSlug: "kdil",
      priceMinor: 0,
      salePriceMinor: null,
      currency: "EUR",
      version: "1.0.0",
      ratingSum: 0,
      ratingCount: 0,
    });
    expect(prod.aggregateRating).toBeUndefined();

    const game = buildGameJsonLd({
      siteUrl: "https://kdilgames.com",
      slug: "byterack-tycoon",
      name: "ByteRack Tycoon",
      description: "Data center idle tycoon",
      platform: "Android",
      version: "1.6.0",
    });
    expect(game["@type"]).toBe("VideoGame");

    const post = buildBlogPostJsonLd({
      siteUrl: "https://kdilgames.com",
      slug: "test-post",
      title: "Test Post",
      excerpt: "Summary",
      publishedAt: "2026-11-25",
      author: "KDILGAMES",
      tags: ["Devlog"],
    });
    expect(post["@type"]).toBe("BlogPosting");
  });
});

describe("HR / EN i18n", () => {
  it("resolves Accept-Language weights accurately", () => {
    expect(resolveLocaleFromAcceptLanguage("hr-HR,hr;q=0.9,en;q=0.8")).toBe("hr");
    expect(resolveLocaleFromAcceptLanguage("en-US,en;q=0.9,hr;q=0.5")).toBe("en");
    expect(resolveLocaleFromAcceptLanguage("de-DE,fr;q=0.8,hr;q=0.7")).toBe("hr");
    expect(resolveLocaleFromAcceptLanguage("ja-JP,zh;q=0.9")).toBe("en");
    expect(resolveLocaleFromAcceptLanguage(null)).toBe("en");
    expect(parseLocale("HR")).toBe("hr");
    expect(parseLocale("de")).toBeNull();
  });

  it("provides matching EN and HR dictionaries and localized blog posts", () => {
    expect(getDictionary("en").ourGames.heading).toBe("Our Games");
    expect(getDictionary("hr").ourGames.heading).toBe("Naše igre");

    const posts = listBlogPosts();
    expect(posts.length).toBeGreaterThanOrEqual(3);
    const first = getBlogPostBySlug("byterack-tycoon-v1-6-devlog");
    expect(first).toBeDefined();
    expect(getLocalizedBlogPost(first!, "hr").title).toContain("ByteRack Tycoon");
  });
});
