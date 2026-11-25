export const AFFILIATE_COOKIE_NAME = "kdil-ref";
export const AFFILIATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const DEFAULT_AFFILIATE_COMMISSION_BPS = 1000; // 10% of platform fee / order commission

export function normalizeAffiliateCode(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  if (cleaned.length < 3 || cleaned.length > 24) return null;
  return cleaned;
}

/**
 * Computes affiliate commission in minor units from the order subtotal/total,
 * capped cleanly so it never exceeds the platform's own marketplace fee.
 */
export function computeAffiliateCommissionMinor(params: {
  orderTotalMinor: number;
  platformFeeMinor: number;
  commissionBps: number;
}): number {
  if (params.orderTotalMinor <= 0 || params.commissionBps <= 0) return 0;
  const raw = Math.floor((params.orderTotalMinor * params.commissionBps) / 10_000);
  if (params.platformFeeMinor > 0) {
    return Math.min(raw, params.platformFeeMinor);
  }
  return raw;
}
