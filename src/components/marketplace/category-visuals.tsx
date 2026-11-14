import {
  Bot,
  Code2,
  Gamepad2,
  LayoutTemplate,
  Package,
  Pickaxe,
  type LucideIcon,
} from "lucide-react";

export type CategoryVisual = {
  icon: LucideIcon;
  /** Local editorial artwork cover image path in public/images/categories/ */
  imageUrl: string | null;
  /** Short crisp tagline badge used in showcase cards */
  shortLabel: string;
  /** Dual-theme tinted chip classes for category icons */
  chipClass: string;
  /** Soft dual-theme background for fallback product thumbnails */
  canvasClass: string;
};

const VISUALS_BY_SLUG: Record<string, CategoryVisual> = {
  roblox: {
    icon: Gamepad2,
    imageUrl: "/images/categories/roblox.jpg",
    shortLabel: "Systems, frameworks & UI",
    chipClass:
      "border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] dark:border-[#3730a3]/60 dark:bg-[#1e1b4b]/70 dark:text-[#a5b4fc]",
    canvasClass: "bg-[#f3f5fc] dark:bg-[#161b2a]",
  },
  minecraft: {
    icon: Pickaxe,
    imageUrl: "/images/categories/minecraft.jpg",
    shortLabel: "Plugins, builds & packs",
    chipClass:
      "border-[#bbf7d0] bg-[#ecfdf5] text-[#166534] dark:border-[#166534]/60 dark:bg-[#14532d]/45 dark:text-[#86efac]",
    canvasClass: "bg-[#f1faf5] dark:bg-[#131f19]",
  },
  "website-templates": {
    icon: LayoutTemplate,
    imageUrl: "/images/categories/website-templates.jpg",
    shortLabel: "Storefronts, UI & themes",
    chipClass:
      "border-[#bae6fd] bg-[#f0f9ff] text-[#075985] dark:border-[#0369a1]/60 dark:bg-[#0c4a6e]/45 dark:text-[#7dd3fc]",
    canvasClass: "bg-[#f2f8fc] dark:bg-[#121d26]",
  },
  "discord-bots": {
    icon: Bot,
    imageUrl: "/images/categories/discord-bots.jpg",
    shortLabel: "Automation & modules",
    chipClass:
      "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6] dark:border-[#5b21b6]/60 dark:bg-[#2e1065]/50 dark:text-[#c4b5fd]",
    canvasClass: "bg-[#f6f4fc] dark:bg-[#191628]",
  },
  "software-dev-tools": {
    icon: Code2,
    imageUrl: "/images/categories/software-dev-tools.jpg",
    shortLabel: "CLI, utilities & libraries",
    chipClass:
      "border-[#fde68a] bg-[#fffbeb] text-[#92400e] dark:border-[#b45309]/60 dark:bg-[#451a03]/50 dark:text-[#fcd34d]",
    canvasClass: "bg-[#fcf9ef] dark:bg-[#211c12]",
  },
  "other-digital-products": {
    icon: Package,
    imageUrl: "/images/categories/other-digital-products.jpg",
    shortLabel: "Creator kits & assets",
    chipClass: "border-line bg-elevated text-ink-muted",
    canvasClass: "bg-elevated",
  },
};

const DEFAULT_VISUAL: CategoryVisual = {
  icon: Package,
  imageUrl: null,
  shortLabel: "Digital assets",
  chipClass: "border-line bg-elevated text-ink-muted",
  canvasClass: "bg-elevated",
};

export function getCategoryVisual(slug: string, iconName?: string | null): CategoryVisual {
  const exact = VISUALS_BY_SLUG[slug];
  if (exact) return exact;

  switch (iconName) {
    case "gamepad-2":
      return VISUALS_BY_SLUG.roblox as CategoryVisual;
    case "pickaxe":
      return VISUALS_BY_SLUG.minecraft as CategoryVisual;
    case "layout-template":
      return VISUALS_BY_SLUG["website-templates"] as CategoryVisual;
    case "bot":
      return VISUALS_BY_SLUG["discord-bots"] as CategoryVisual;
    case "code":
      return VISUALS_BY_SLUG["software-dev-tools"] as CategoryVisual;
    default:
      return DEFAULT_VISUAL;
  }
}
