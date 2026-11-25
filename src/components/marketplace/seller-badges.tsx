import { Award, BadgeCheck, Flame, Layers, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SellerBadge, SellerBadgeId } from "@/lib/seller/badges";

const ICONS: Record<SellerBadgeId, typeof BadgeCheck> = {
  verified: BadgeCheck,
  top_seller: Flame,
  highly_rated: Award,
  prolific: Layers,
  established: ShieldCheck,
  active_maintainer: Sparkles,
};

export function SellerBadges({ badges }: { badges: SellerBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Creator badges">
      {badges.map((badge) => {
        const Icon = ICONS[badge.id];
        return (
          <span key={badge.id} title={badge.description}>
            <Badge tone={badge.tone}>
              <Icon className="size-3" aria-hidden />
              {badge.label}
            </Badge>
          </span>
        );
      })}
    </div>
  );
}
