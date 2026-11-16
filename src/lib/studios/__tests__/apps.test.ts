import { describe, expect, it } from "vitest";

import {
  STUDIO_APPS,
  STUDIO_GENERAL_PRIVACY,
  getStudioAppBySlug,
  listStudioApps,
} from "../apps";

describe("KDILGAMES Software Studios catalog", () => {
  it("lists unique slugs and non-empty privacy policies for every app", () => {
    const apps = listStudioApps();
    expect(apps.length).toBeGreaterThanOrEqual(1);

    const slugs = new Set<string>();
    for (const app of apps) {
      expect(app.slug).toMatch(/^[a-z0-9-]+$/);
      expect(slugs.has(app.slug)).toBe(false);
      slugs.add(app.slug);
      expect(app.privacyPolicy.sections.length).toBeGreaterThan(0);
      expect(app.packageName.length).toBeGreaterThan(0);
    }
  });

  it("includes ByteRack Tycoon with matching Android package ID and Play privacy coverage", () => {
    const byteRack = getStudioAppBySlug("byterack-tycoon");
    expect(byteRack).toBeDefined();
    expect(byteRack?.packageName).toBe("com.karlo.byterack");
    expect(byteRack?.privacyPolicy.summary.toLowerCase()).toContain("offline-first");
    expect(STUDIO_GENERAL_PRIVACY.sections.length).toBeGreaterThan(0);
    expect(STUDIO_APPS).toContain(byteRack);
  });

  it("returns undefined for unknown studio app slugs", () => {
    expect(getStudioAppBySlug("does-not-exist")).toBeUndefined();
  });
});
