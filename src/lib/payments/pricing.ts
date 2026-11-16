/**
 * Pure pricing, bundle proration, and promo coupon discount allocation helpers.
 *
 * All calculations operate on integer minor units (cents) and never use floats
 * to divide or store money.
 */

export type PricingLineInput = {
  productId: string;
  sellerId: string;
  unitPriceMinor: number;
  currency: string;
};

export type CouponCandidate = {
  id: string;
  code: string;
  sellerId: string | null;
  discountType: "PERCENT" | "FIXED";
  percentOff: number | null;
  amountOffMinor: number | null;
  currency: string;
  minSubtotalMinor: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
  expiresAt: Date | null;
};

export type CouponEvaluationResult =
  | {
      valid: true;
      couponId: string;
      code: string;
      discountMinor: number;
      lineDiscounts: number[];
    }
  | {
      valid: false;
      reason: string;
    };

/** Stripe Checkout requires positive sessions to total at least 50 minor units (0.50). */
export const STRIPE_MIN_CHARGE_MINOR = 50;

/**
 * Allocates `targetMinor` across items proportionally to `weights` using largest-remainder
 * apportionment so the returned integer amounts always sum strictly to `targetMinor`.
 */
export function allocateMinorProportionally(weights: number[], targetMinor: number): number[] {
  const count = weights.length;
  if (count === 0) return [];
  if (targetMinor <= 0) return new Array<number>(count).fill(0);

  const sanitized = weights.map((weight) => Math.max(0, Math.round(weight)));
  const totalWeight = sanitized.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    const base = Math.floor(targetMinor / count);
    const remainder = targetMinor - base * count;
    return sanitized.map((_, index) => base + (index < remainder ? 1 : 0));
  }

  const shares = sanitized.map((weight, index) => {
    const numerator = targetMinor * weight;
    const floorShare = Math.floor(numerator / totalWeight);
    const rem = numerator % totalWeight;
    return { index, floorShare, rem, weight };
  });

  const allocated = shares.map((entry) => entry.floorShare);
  let remaining = targetMinor - allocated.reduce((sum, amount) => sum + amount, 0);

  shares.sort((a, b) => {
    if (b.rem !== a.rem) return b.rem - a.rem;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.index - b.index;
  });

  let cursor = 0;
  while (remaining > 0) {
    const target = shares[cursor % count];
    if (target) {
      allocated[target.index] = (allocated[target.index] ?? 0) + 1;
      remaining -= 1;
    }
    cursor += 1;
  }

  return allocated;
}

/**
 * Evaluates a promo coupon against cart lines and returns exact per-line discounts.
 */
export function evaluateCouponForLines(params: {
  lines: PricingLineInput[];
  coupon: CouponCandidate;
  cartCurrency: string;
  now?: Date;
}): CouponEvaluationResult {
  const { lines, coupon, cartCurrency } = params;
  const now = params.now ?? new Date();

  if (!coupon.isActive) {
    return { valid: false, reason: `Promo code “${coupon.code}” is no longer active.` };
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: `Promo code “${coupon.code}” has expired.` };
  }
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { valid: false, reason: `Promo code “${coupon.code}” has reached its usage limit.` };
  }

  const eligibleIndices: number[] = [];
  let eligibleSubtotalMinor = 0;
  let cartSubtotalMinor = 0;

  lines.forEach((line, index) => {
    cartSubtotalMinor += line.unitPriceMinor;
    const matchesSeller = coupon.sellerId === null || line.sellerId === coupon.sellerId;
    if (matchesSeller && line.unitPriceMinor > 0) {
      eligibleIndices.push(index);
      eligibleSubtotalMinor += line.unitPriceMinor;
    }
  });

  if (eligibleSubtotalMinor <= 0) {
    return {
      valid: false,
      reason: coupon.sellerId
        ? `Promo code “${coupon.code}” only applies to paid products from that creator's store.`
        : `Promo code “${coupon.code}” requires at least one paid item in your cart.`,
    };
  }

  if (coupon.discountType === "FIXED" && coupon.currency !== cartCurrency) {
    return {
      valid: false,
      reason: `Promo code “${coupon.code}” applies to ${coupon.currency} purchases.`,
    };
  }

  if (coupon.minSubtotalMinor !== null && eligibleSubtotalMinor < coupon.minSubtotalMinor) {
    const needed = (coupon.minSubtotalMinor / 100).toFixed(2);
    return {
      valid: false,
      reason: `Promo code “${coupon.code}” requires at least ${needed} ${cartCurrency} of eligible items.`,
    };
  }

  let rawDiscountMinor = 0;
  if (coupon.discountType === "PERCENT") {
    const pct = Math.max(0, Math.min(100, coupon.percentOff ?? 0));
    rawDiscountMinor = Math.round((eligibleSubtotalMinor * pct) / 100);
  } else {
    rawDiscountMinor = Math.min(eligibleSubtotalMinor, Math.max(0, coupon.amountOffMinor ?? 0));
  }

  if (rawDiscountMinor <= 0) {
    return { valid: false, reason: `Promo code “${coupon.code}” did not reduce the cart total.` };
  }

  const postTotal = cartSubtotalMinor - rawDiscountMinor;
  if (postTotal > 0 && postTotal < STRIPE_MIN_CHARGE_MINOR) {
    return {
      valid: false,
      reason: `This discount would leave a remaining balance under 0.50 ${cartCurrency}, below Stripe's minimum card charge.`,
    };
  }

  const eligibleWeights = eligibleIndices.map((index) => lines[index]?.unitPriceMinor ?? 0);
  const eligibleDiscounts = allocateMinorProportionally(eligibleWeights, rawDiscountMinor);

  const lineDiscounts = new Array<number>(lines.length).fill(0);
  eligibleIndices.forEach((lineIndex, eligiblePos) => {
    const linePrice = lines[lineIndex]?.unitPriceMinor ?? 0;
    const disc = Math.min(linePrice, eligibleDiscounts[eligiblePos] ?? 0);
    lineDiscounts[lineIndex] = disc;
  });

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountMinor: lineDiscounts.reduce((sum, val) => sum + val, 0),
    lineDiscounts,
  };
}
