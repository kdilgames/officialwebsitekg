import { describe, expect, it } from "vitest";

import {
  encodeUpdateChangelog,
  formatVersionNotificationBody,
  parseUpdateChangelog,
} from "../update-format";

describe("update-format", () => {
  it("encodes and parses structured update title and BBCode body", () => {
    const encoded = encodeUpdateChangelog(
      "🚀 ACS V4.0 Enterprise Edition is here!",
      "[h2]Major New Features[/h2]\n[list][*]Hybrid engine[/list]",
    );
    const parsed = parseUpdateChangelog(encoded);

    expect(parsed.title).toBe("🚀 ACS V4.0 Enterprise Edition is here!");
    expect(parsed.body).toBe("[h2]Major New Features[/h2]\n[list][*]Hybrid engine[/list]");
  });

  it("leaves legacy plain-text or untitled changelogs untouched", () => {
    const parsed = parseUpdateChangelog("Initial release.");
    expect(parsed).toEqual({ title: null, body: "Initial release." });

    expect(encodeUpdateChangelog("   ", "[b]Patch[/b]")).toBe("[b]Patch[/b]");
  });

  it("sanitizes newlines and nested markers in titles and builds concise notification text", () => {
    const encoded = encodeUpdateChangelog("Line 1\nLine 2 [/update-title]", "[b]Details[/b]");
    const parsed = parseUpdateChangelog(encoded);
    expect(parsed.title).toBe("Line 1 Line 2");
    expect(parsed.body).toBe("[b]Details[/b]");

    expect(formatVersionNotificationBody(encoded, "4.0.0")).toBe("Line 1 Line 2 — Details");
  });
});
