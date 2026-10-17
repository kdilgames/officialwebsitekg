import { env } from "@/lib/env";

export type CommissionScopeName = "GLOBAL" | "CATEGORY" | "SELLER" | "PRODUCT";

export interface CommissionRuleLike {
  scope: CommissionScopeName;
  targetId: string | null;
  rateBps: number;
  isActive: boolean;
}

export interface CommissionContext {
  productId: string;
  categoryId: string;
  sellerId: string;
  /** Per-seller override stored on the seller profile, if any. */
  sellerCommissionBps?: number | null;
  rules: CommissionRuleLike[];
  /** Used when neither a rule nor a seller override applies. */
  defaultRateBps?: number;
}

export type CommissionSource = CommissionScopeName | "SELLER_OVERRIDE" | "DEFAULT";

export interface ResolvedCommissionRate {
  rateBps: number;
  source: CommissionSource;
}

export interface CommissionSplit {
  grossMinor: number;
  rateBps: number;
  platformFeeMinor: number;
  sellerNetMinor: number;
}

/** Commission rates are expressed in basis points: 1500 = 15%. */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function formatBps(bps: number): string {
  const percent = bpsToPercent(bps);
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

export function clampBps(bps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(bps)));
}

/**
 * Split a gross amount into the platform fee and the seller's net.
 * The platform fee is rounded to the nearest minor unit and the seller keeps the
 * exact remainder, so the two parts always add up to the gross amount.
 */
export function splitRevenue(grossMinor: number, rateBps: number): CommissionSplit {
  const rate = clampBps(rateBps);
  const platformFeeMinor = Math.round((grossMinor * rate) / 10_000);
  return {
    grossMinor,
    rateBps: rate,
    platformFeeMinor,
    sellerNetMinor: grossMinor - platformFeeMinor,
  };
}

/**
 * Resolve the commission rate for a sale.
 * Precedence: PRODUCT rule > seller-profile override > SELLER rule > CATEGORY rule > GLOBAL rule > default.
 */
export function resolveCommissionRate(ctx: CommissionContext): ResolvedCommissionRate {
  const activeRules = ctx.rules.filter((rule) => rule.isActive);
  const findRule = (scope: CommissionScopeName, targetId: string | null) =>
    activeRules.find((rule) => rule.scope === scope && rule.targetId === targetId);

  const productRule = findRule("PRODUCT", ctx.productId);
  if (productRule) return { rateBps: clampBps(productRule.rateBps), source: "PRODUCT" };

  if (typeof ctx.sellerCommissionBps === "number") {
    return { rateBps: clampBps(ctx.sellerCommissionBps), source: "SELLER_OVERRIDE" };
  }

  const sellerRule = findRule("SELLER", ctx.sellerId);
  if (sellerRule) return { rateBps: clampBps(sellerRule.rateBps), source: "SELLER" };

  const categoryRule = findRule("CATEGORY", ctx.categoryId);
  if (categoryRule) return { rateBps: clampBps(categoryRule.rateBps), source: "CATEGORY" };

  const globalRule = findRule("GLOBAL", null);
  if (globalRule) return { rateBps: clampBps(globalRule.rateBps), source: "GLOBAL" };

  return {
    rateBps: clampBps(ctx.defaultRateBps ?? env.marketplace.defaultCommissionBps),
    source: "DEFAULT",
  };
}
