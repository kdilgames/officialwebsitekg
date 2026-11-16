import { inferRootCategorySlug } from "@/lib/catalog-hierarchy";

/**
 * Curated compatibility and topic tags tailored for each marketplace category.
 *
 * Used both as quick discovery pills on Browse/Category pages and as clickable
 * suggestions in the seller listing form.
 */

export const CATEGORY_COMPATIBILITY_TAGS: Record<string, string[]> = {
  roblox: [
    "luau",
    "knit",
    "profileservice",
    "datastore",
    "ui-kit",
    "combat",
    "economy",
    "admin",
  ],
  minecraft: [
    "paper",
    "spigot",
    "purpur",
    "velocity",
    "folia",
    "java-21",
    "skript",
    "resource-pack",
  ],
  "website-templates": [
    "nextjs",
    "react",
    "tailwind",
    "typescript",
    "html-css",
    "saas",
    "portfolio",
    "docs",
  ],
  "discord-bots": [
    "discord-js",
    "typescript",
    "python",
    "pycord",
    "moderation",
    "tickets",
    "economy",
    "dashboard",
  ],
  "software-dev-tools": [
    "cli",
    "nodejs",
    "rust",
    "python",
    "docker",
    "api",
    "desktop",
    "automation",
  ],
  "other-digital-products": [
    "sfx",
    "3d-models",
    "icons",
    "fonts",
    "shaders",
    "ui-assets",
    "docs",
  ],
};

const POPULAR_FALLBACK_TAGS = [
  "luau",
  "paper",
  "nextjs",
  "tailwind",
  "discord-js",
  "typescript",
  "python",
  "ui-kit",
];

export function getCompatibilityTagsForCategory(
  categorySlug?: string | null,
  parentSlug?: string | null,
): string[] {
  if (!categorySlug && !parentSlug) return POPULAR_FALLBACK_TAGS;
  if (categorySlug && CATEGORY_COMPATIBILITY_TAGS[categorySlug]) {
    return CATEGORY_COMPATIBILITY_TAGS[categorySlug];
  }
  const rootSlug = inferRootCategorySlug(categorySlug, parentSlug);
  if (rootSlug && CATEGORY_COMPATIBILITY_TAGS[rootSlug]) {
    return CATEGORY_COMPATIBILITY_TAGS[rootSlug];
  }
  return POPULAR_FALLBACK_TAGS;
}
