import { describe, expect, it } from "vitest";

import {
  DEFAULT_PARENT_CATEGORIES,
  DEFAULT_SUBCATEGORIES,
  buildCategoryTree,
  formatCategoryCount,
  inferRootCategorySlug,
} from "../catalog-hierarchy";

describe("catalog-hierarchy", () => {
  it("groups parent and child categories and sums descendant counts", () => {
    const tree = buildCategoryTree([
      { id: "r", name: "Roblox", slug: "roblox", parentId: null, _count: { products: 2 } },
      { id: "r-scripts", name: "Scripts", slug: "roblox-scripts", parentId: "r", _count: { products: 5 } },
      { id: "r-maps", name: "Maps", slug: "roblox-maps", parentId: "r", _count: { products: 3 } },
      { id: "m", name: "Minecraft", slug: "minecraft", parentId: null, _count: { products: 4 } },
    ]);

    expect(tree).toHaveLength(2);
    expect(tree[0]?.totalProducts).toBe(10);
    expect(tree[0]?.children.map((c) => c.slug)).toEqual(["roblox-scripts", "roblox-maps"]);
    expect(tree[1]?.totalProducts).toBe(4);
    expect(tree[1]?.children).toEqual([]);
  });

  it("maps subcategory slugs back to their root category ecosystem", () => {
    expect(inferRootCategorySlug("roblox-scripts")).toBe("roblox");
    expect(inferRootCategorySlug("minecraft-plugins")).toBe("minecraft");
    expect(inferRootCategorySlug("website-storefronts")).toBe("website-templates");
    expect(inferRootCategorySlug("discord-full-bots")).toBe("discord-bots");
    expect(inferRootCategorySlug("software-cli-automation")).toBe("software-dev-tools");
    expect(inferRootCategorySlug("custom-sub", "roblox")).toBe("roblox");
  });

  it("has unique slugs across all default categories and subcategories", () => {
    const all = [...DEFAULT_PARENT_CATEGORIES, ...DEFAULT_SUBCATEGORIES];
    const slugs = all.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("formats compact category counts", () => {
    expect(formatCategoryCount(0)).toBe("0");
    expect(formatCategoryCount(47)).toBe("47");
    expect(formatCategoryCount(1200)).toBe("1.2K");
    expect(formatCategoryCount(19400)).toBe("19K");
  });
});
