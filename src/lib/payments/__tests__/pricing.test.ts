import { describe, expect, it } from "vitest";

import { allocateMinorProportionally, evaluateCouponForLines, type CouponCandidate } from "../pricing";

function makeCoupon(overrides: Partial<CouponCandidate> = {}): CouponCandidate {
  return {
    id: "coupon-1",
    code: "SAVE20",
    sellerId: null,
    discountType: "PERCENT",
    percentOff: 20,
    amountOffMinor: null,
    currency: "EUR",
    minSubtotalMinor: null,
    maxRedemptions: null,
    redemptionCount: 0,
    isActive: true,
    expiresAt: null,
    ...overrides,
  };
}

describe("allocateMinorProportionally", () => {
  it("distributes remainders accurately to match exact target minor units", () => {
    const shares = allocateMinorProportionally([1000, 1000, 1000], 100);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares).toEqual([34, 33, 33]);
  });

  it("handles unequal weights and zero target cleanly", () => {
    expect(allocateMinorProportionally([500, 1500], 0)).toEqual([0, 0]);
    const weighted = allocateMinorProportionally([500, 1500], 600);
    expect(weighted).toEqual([150, 450]);
  });

  it("handles all-zero weights evenly", () => {
    expect(allocateMinorProportionally([0, 0, 0], 10)).toEqual([4, 3, 3]);
  });
});

describe("evaluateCouponForLines", () => {
  it("applies percentage discount across platform lines", () => {
    const result = evaluateCouponForLines({
      cartCurrency: "EUR",
      coupon: makeCoupon({ percentOff: 25 }),
      lines: [
        { productId: "p1", sellerId: "s1", unitPriceMinor: 1000, currency: "EUR" },
        { productId: "p2", sellerId: "s2", unitPriceMinor: 2000, currency: "EUR" },
      ],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.discountMinor).toBe(750);
      expect(result.lineDiscounts).toEqual([250, 500]);
    }
  });

  it("scopes seller coupons strictly to the issuing store", () => {
    const result = evaluateCouponForLines({
      cartCurrency: "EUR",
      coupon: makeCoupon({ sellerId: "s1", discountType: "FIXED", percentOff: null, amountOffMinor: 500 }),
      lines: [
        { productId: "p1", sellerId: "s1", unitPriceMinor: 1200, currency: "EUR" },
        { productId: "p2", sellerId: "s2", unitPriceMinor: 2000, currency: "EUR" },
      ],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.discountMinor).toBe(500);
      expect(result.lineDiscounts).toEqual([500, 0]);
    }
  });

  it("allows 100% promo codes that drop the total cleanly to zero", () => {
    const result = evaluateCouponForLines({
      cartCurrency: "EUR",
      coupon: makeCoupon({ percentOff: 100 }),
      lines: [{ productId: "p1", sellerId: "s1", unitPriceMinor: 1500, currency: "EUR" }],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.discountMinor).toBe(1500);
      expect(result.lineDiscounts).toEqual([1500]);
    }
  });

  it("rejects partial discounts that would leave less than Stripe minimum 0.50", () => {
    const result = evaluateCouponForLines({
      cartCurrency: "EUR",
      coupon: makeCoupon({ discountType: "FIXED", percentOff: null, amountOffMinor: 970 }),
      lines: [{ productId: "p1", sellerId: "s1", unitPriceMinor: 1000, currency: "EUR" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects expired or exhausted coupons", () => {
    const expired = evaluateCouponForLines({
      cartCurrency: "EUR",
      coupon: makeCoupon({ expiresAt: new Date("2020-01-01T00:00:00Z") }),
      lines: [{ productId: "p1", sellerId: "s1", unitPriceMinor: 1000, currency: "EUR" }],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(expired.valid).toBe(false);

    const capped = evaluateCouponForLines({
      cartCurrency: "EUR",
      coupon: makeCoupon({ maxRedemptions: 5, redemptionCount: 5 }),
      lines: [{ productId: "p1", sellerId: "s1", unitPriceMinor: 1000, currency: "EUR" }],
    });
    expect(capped.valid).toBe(false);
  });
});
