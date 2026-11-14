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
  /** Subtle tinted chip classes for icons and fallback thumbnail panels */
  chipClass: string;
  /** Soft background for fallback product thumbnails */
  canvasClass: string;
};

const VISUALS_BY_SLUG: Record<string, CategoryVisual> = {
  roblox: {
    icon: Gamepad2,
    chipClass: "border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]",
    canvasClass: "bg-[#f3f5fc]",
  },
  minecraft: {
    icon: Pickaxe,
    chipClass: "border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]",
    canvasClass: "bg-[#f1faf5]",
  },
  "website-templates": {
    icon: LayoutTemplate,
    chipClass: "border-[#bae6fd] bg-[#f0f9ff] text-[#075985]",
    canvasClass: "bg-[#f2f8fc]",
  },
  "discord-bots": {
    icon: Bot,
    chipClass: "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]",
    canvasClass: "bg-[#f6f4fc]",
  },
  "software-dev-tools": {
    icon: Code2,
    chipClass: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
    canvasClass: "bg-[#fcf9ef]",
  },
  "other-digital-products": {
    icon: Package,
    chipClass: "border-line bg-elevated text-ink-muted",
    canvasClass: "bg-elevated",
  },
};

const DEFAULT_VISUAL: CategoryVisual = {
  icon: Package,
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
