/**
 * Canonical marketplace category tree (top-level ecosystems + structured
 * subcategories) and pure hierarchy utilities shared by seeding, admin
 * setup actions, navigation dropdowns, and cascading upload selectors.
 */

export type CategorySeedEntry = {
  name: string;
  slug: string;
  icon: string;
  description: string;
};

export type SubcategorySeedEntry = CategorySeedEntry & {
  parentSlug: string;
};

export const DEFAULT_PARENT_CATEGORIES: CategorySeedEntry[] = [
  {
    name: "Roblox",
    slug: "roblox",
    icon: "gamepad-2",
    description: "Game systems, frameworks, UI kits and models for Roblox experiences.",
  },
  {
    name: "Minecraft",
    slug: "minecraft",
    icon: "pickaxe",
    description: "Plugins, server setups, resource packs and world assets for Minecraft.",
  },
  {
    name: "Website templates",
    slug: "website-templates",
    icon: "layout-template",
    description: "Front-end templates, themes and complete storefront builds.",
  },
  {
    name: "Discord bots",
    slug: "discord-bots",
    icon: "bot",
    description: "Bots and bot modules, with or without source code depending on the listing.",
  },
  {
    name: "Software & dev tools",
    slug: "software-dev-tools",
    icon: "code",
    description: "Applications, libraries, scripts and developer tooling.",
  },
  {
    name: "Other digital products",
    slug: "other-digital-products",
    icon: "package",
    description: "Digital goods that do not fit the categories above.",
  },
];

export const DEFAULT_SUBCATEGORIES: SubcategorySeedEntry[] = [
  // Roblox
  {
    parentSlug: "roblox",
    name: "Game setups",
    slug: "roblox-game-setups",
    icon: "wrench",
    description: "Complete Roblox game templates, simulators, obbies and ready-to-launch places.",
  },
  {
    parentSlug: "roblox",
    name: "Maps",
    slug: "roblox-maps",
    icon: "map",
    description: "Custom maps, lobbies, arenas, cities and terrain environments for Roblox.",
  },
  {
    parentSlug: "roblox",
    name: "Scripts",
    slug: "roblox-scripts",
    icon: "code-2",
    description: "Luau scripts, anti-cheat frameworks, combat systems and server modules.",
  },
  {
    parentSlug: "roblox",
    name: "Vehicles",
    slug: "roblox-vehicles",
    icon: "car",
    description: "Cars, aircraft, boats and tuned chassis kits for Roblox.",
  },
  {
    parentSlug: "roblox",
    name: "Weapons",
    slug: "roblox-weapons",
    icon: "crosshair",
    description: "Gun frameworks, melee packs, viewmodels and combat tools.",
  },
  {
    parentSlug: "roblox",
    name: "Models",
    slug: "roblox-models",
    icon: "box",
    description: "3D props, modular buildings, studio packs and environment models.",
  },
  {
    parentSlug: "roblox",
    name: "Clothing",
    slug: "roblox-clothing",
    icon: "shirt",
    description: "Uniforms, outfits, layered clothing and character accessories.",
  },
  {
    parentSlug: "roblox",
    name: "Graphics & UI",
    slug: "roblox-graphics-ui",
    icon: "palette",
    description: "HUDs, shop interfaces, icon packs and game UI kits.",
  },
  {
    parentSlug: "roblox",
    name: "Animations & VFX",
    slug: "roblox-animations-vfx",
    icon: "sparkles",
    description: "R6/R15 animations, emotes, particle effects and ability VFX.",
  },
  {
    parentSlug: "roblox",
    name: "Audio",
    slug: "roblox-audio",
    icon: "music",
    description: "Sound effects, UI feedback sounds and ambient audio packs.",
  },

  // Minecraft
  {
    parentSlug: "minecraft",
    name: "Plugins",
    slug: "minecraft-plugins",
    icon: "plug",
    description: "Paper, Spigot, Purpur, Folia and Velocity Java plugins.",
  },
  {
    parentSlug: "minecraft",
    name: "Server setups",
    slug: "minecraft-server-setups",
    icon: "server",
    description: "Pre-configured SMP, Skyblock, Prison, Factions and Hub setups.",
  },
  {
    parentSlug: "minecraft",
    name: "Maps & builds",
    slug: "minecraft-maps-builds",
    icon: "map",
    description: "Spawns, hubs, dungeons, arenas and schematic builds.",
  },
  {
    parentSlug: "minecraft",
    name: "Resource packs",
    slug: "minecraft-resource-packs",
    icon: "image",
    description: "Custom textures, ItemsAdder/Oraxen packs and GUI overlays.",
  },
  {
    parentSlug: "minecraft",
    name: "Skripts & configs",
    slug: "minecraft-skripts-configs",
    icon: "file-code",
    description: "Skript modules, DeluxeMenus, crate configs and permission setups.",
  },
  {
    parentSlug: "minecraft",
    name: "3D models",
    slug: "minecraft-models",
    icon: "box",
    description: "Blockbench mobs, cosmetics, furniture and MythicMobs models.",
  },

  // Website templates
  {
    parentSlug: "website-templates",
    name: "Storefronts",
    slug: "website-storefronts",
    icon: "shopping-bag",
    description: "Store themes, checkout layouts and digital shop templates.",
  },
  {
    parentSlug: "website-templates",
    name: "Game server sites",
    slug: "website-game-server-sites",
    icon: "globe",
    description: "Community portals and landing pages for game servers and studios.",
  },
  {
    parentSlug: "website-templates",
    name: "Portfolios",
    slug: "website-portfolios",
    icon: "layout",
    description: "Minimal portfolio and showcase sites for developers and teams.",
  },
  {
    parentSlug: "website-templates",
    name: "UI kits & components",
    slug: "website-ui-kits",
    icon: "layers",
    description: "Reusable React, Next.js and Tailwind component libraries.",
  },

  // Discord bots
  {
    parentSlug: "discord-bots",
    name: "Full bots",
    slug: "discord-full-bots",
    icon: "bot",
    description: "Moderation, ticket, verification, leveling and economy bots.",
  },
  {
    parentSlug: "discord-bots",
    name: "Modules & cogs",
    slug: "discord-modules-cogs",
    icon: "puzzle",
    description: "Drop-in command modules, handlers and integrations.",
  },
  {
    parentSlug: "discord-bots",
    name: "Dashboards & panels",
    slug: "discord-dashboards",
    icon: "layout-dashboard",
    description: "Web control dashboards and Discord OAuth management panels.",
  },
  {
    parentSlug: "discord-bots",
    name: "Server templates",
    slug: "discord-server-templates",
    icon: "sparkles",
    description: "Structured channel layouts, embed packs and onboarding kits.",
  },

  // Software & dev tools
  {
    parentSlug: "software-dev-tools",
    name: "CLI & automation",
    slug: "software-cli-automation",
    icon: "terminal",
    description: "Command-line utilities, deployment tools and workflow scripts.",
  },
  {
    parentSlug: "software-dev-tools",
    name: "Desktop apps",
    slug: "software-desktop-apps",
    icon: "monitor",
    description: "Standalone desktop tools for creators, artists and studios.",
  },
  {
    parentSlug: "software-dev-tools",
    name: "APIs & libraries",
    slug: "software-apis-libraries",
    icon: "code-2",
    description: "Backend microservices, SDKs and reusable developer packages.",
  },
];

export type FlatCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  parentId: string | null;
  _count?: { products: number };
};

export type CategoryTreeNode = FlatCategoryRow & {
  directProducts: number;
  totalProducts: number;
  children: Array<FlatCategoryRow & { directProducts: number }>;
};

export function buildCategoryTree(categories: FlatCategoryRow[]): CategoryTreeNode[] {
  const byId = new Map<string, FlatCategoryRow>();
  for (const category of categories) {
    byId.set(category.id, category);
  }

  const childrenMap = new Map<string, Array<FlatCategoryRow & { directProducts: number }>>();
  const roots: FlatCategoryRow[] = [];

  for (const category of categories) {
    if (category.parentId && byId.has(category.parentId)) {
      const list = childrenMap.get(category.parentId) ?? [];
      list.push({
        ...category,
        directProducts: category._count?.products ?? 0,
      });
      childrenMap.set(category.parentId, list);
    } else {
      roots.push(category);
    }
  }

  return roots.map((root) => {
    const children = childrenMap.get(root.id) ?? [];
    const directProducts = root._count?.products ?? 0;
    const childTotal = children.reduce((sum, child) => sum + child.directProducts, 0);
    return {
      ...root,
      directProducts,
      totalProducts: directProducts + childTotal,
      children,
    };
  });
}

export function inferRootCategorySlug(
  slug?: string | null,
  parentSlug?: string | null,
): string | null {
  if (parentSlug) return parentSlug;
  if (!slug) return null;
  if (slug === "roblox" || slug.startsWith("roblox-")) return "roblox";
  if (slug === "minecraft" || slug.startsWith("minecraft-")) return "minecraft";
  if (slug === "website-templates" || slug.startsWith("website-")) return "website-templates";
  if (slug === "discord-bots" || slug.startsWith("discord-")) return "discord-bots";
  if (slug === "software-dev-tools" || slug.startsWith("software-")) return "software-dev-tools";
  if (slug === "other-digital-products") return "other-digital-products";
  return slug;
}

export function formatCategoryCount(count: number): string {
  if (count >= 1000) {
    const compact = count >= 10_000 ? Math.round(count / 1000).toString() : (count / 1000).toFixed(1);
    return `${compact.replace(/\.0$/, "")}K`;
  }
  return String(Math.max(0, count));
}
