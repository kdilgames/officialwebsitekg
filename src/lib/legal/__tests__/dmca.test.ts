import { describe, expect, it } from "vitest";

import {
  dmcaNoticeSchema,
  extractProductSlugFromUrl,
  generateDmcaNoticeNumber,
} from "../dmca";

describe("DMCA helpers", () => {
  it("extracts product slug from marketplace URLs", () => {
    expect(extractProductSlugFromUrl("https://kdilgames.com/product/super-bot")).toBe("super-bot");
    expect(extractProductSlugFromUrl("https://kdilgames.com/product/my-pack/?tab=reviews")).toBe(
      "my-pack",
    );
    expect(extractProductSlugFromUrl("https://kdilgames.com/browse")).toBeNull();
    expect(extractProductSlugFromUrl("not-a-url")).toBeNull();
  });

  it("generates dated DMCA reference numbers", () => {
    const num = generateDmcaNoticeNumber(new Date("2026-11-25T12:00:00Z"));
    expect(num).toMatch(/^DMCA-20261125-[A-Z0-9]{4}$/);
  });

  it("validates required declarations and fields", () => {
    const valid = dmcaNoticeSchema.safeParse({
      claimantName: "Jane Doe",
      claimantEmail: "legal@example.com",
      productUrl: "https://kdilgames.com/product/copied-tool",
      originalWorkUrl: "https://github.com/janedoe/original-tool",
      description: "This listing redistributes our proprietary source code without permission.",
      goodFaithStatement: "true",
      accuracyStatement: "true",
      signature: "Jane Doe",
    });
    expect(valid.success).toBe(true);

    const missingDeclaration = dmcaNoticeSchema.safeParse({
      claimantName: "Jane Doe",
      claimantEmail: "legal@example.com",
      productUrl: "https://kdilgames.com/product/copied-tool",
      originalWorkUrl: "https://github.com/janedoe/original-tool",
      description: "This listing redistributes our proprietary source code without permission.",
      goodFaithStatement: "false",
      accuracyStatement: "true",
      signature: "Jane Doe",
    });
    expect(missingDeclaration.success).toBe(false);
  });
});
