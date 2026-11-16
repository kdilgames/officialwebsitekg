import { describe, expect, it } from "vitest";

import { normalizeProductTab } from "../product-tabs";

describe("normalizeProductTab", () => {
  it("keeps supported tab query values intact", () => {
    expect(normalizeProductTab("updates")).toBe("updates");
    expect(normalizeProductTab("reviews")).toBe("reviews");
    expect(normalizeProductTab("qa")).toBe("qa");
  });

  it("defaults missing, overview, or unknown tab parameters safely to overview", () => {
    expect(normalizeProductTab(undefined)).toBe("overview");
    expect(normalizeProductTab("")).toBe("overview");
    expect(normalizeProductTab("overview")).toBe("overview");
    expect(normalizeProductTab("UPDATES")).toBe("overview");
    expect(normalizeProductTab("arbitrary")).toBe("overview");
  });
});
