export type SellerBadgeId =
  | "verified"
  | "top_seller"
  | "highly_rated"
  | "prolific"
  | "established"
  | "active_maintainer";

export type SellerBadge = {
  id: SellerBadgeId;
  label: string;
  description: string;
  tone: "positive" | "accent" | "caution" | "neutral";
};

export type SellerBadgeMetrics = {
  isApproved: boolean;
  salesCount: number;
  publishedProductsCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: Date;
  hasRecentUpdate?: boolean;
  latestUpdateAt?: Date | null;
};

/**
 * Computes earned creator trust badges strictly from real persisted metrics.
 * Never invents vanity stats or unverified claims.
 */
export function computeSellerBadges(
  metrics: SellerBadgeMetrics,
  now = new Date(),
): SellerBadge[] {
  const badges: SellerBadge[] = [];

  if (metrics.isApproved) {
    badges.push({
      id: "verified",
      label: "Verified Creator",
      description: "Reviewed and approved marketplace creator.",
      tone: "positive",
    });
  }

  if (metrics.salesCount >= 25) {
    badges.push({
      id: "top_seller",
      label: "Top Seller",
      description: `${metrics.salesCount} completed orders on KDILGAMES.`,
      tone: "accent",
    });
  }

  if (metrics.ratingCount >= 5 && metrics.ratingAverage !== null && metrics.ratingAverage >= 4.7) {
    badges.push({
      id: "highly_rated",
      label: "Top Rated",
      description: `${metrics.ratingAverage.toFixed(1)} average across ${metrics.ratingCount} verified reviews.`,
      tone: "caution",
    });
  }

  if (metrics.publishedProductsCount >= 5) {
    badges.push({
      id: "prolific",
      label: "Prolific Studio",
      description: `${metrics.publishedProductsCount} published resources.`,
      tone: "neutral",
    });
  }

  const ageDays = (now.getTime() - metrics.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= 180) {
    badges.push({
      id: "established",
      label: "Established",
      description: "Active creator on KDILGAMES for 6+ months.",
      tone: "neutral",
    });
  }

  const recentUpdate =
    metrics.hasRecentUpdate ||
    (metrics.latestUpdateAt != null &&
      now.getTime() - metrics.latestUpdateAt.getTime() <= 30 * 24 * 60 * 60 * 1000);

  if (recentUpdate) {
    badges.push({
      id: "active_maintainer",
      label: "Active Updates",
      description: "Shipped a product update within the past 30 days.",
      tone: "positive",
    });
  }

  return badges;
}
