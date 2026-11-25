import { describe, expect, it } from "vitest";

import { computeAffiliateCommissionMinor, normalizeAffiliateCode } from "../affiliate/rules";
import { generateLicenseKey, isValidLicenseKeyFormat, normalizeLicenseKey } from "../licenses/keys";
import {
  formatFlashCountdown,
  getEffectivePriceMinor,
  isFlashSaleActive,
  isSaleActive,
} from "../marketplace/flash-sale";
import { computeSellerBadges } from "../seller/badges";

describe("License keys", () => {
  it("generates unique, valid KDIL-XXXX-XXXX-XXXX-XXXX license keys", () => {
    const a = generateLicenseKey();
    const b = generateLicenseKey();
    expect(isValidLicenseKeyFormat(a)).toBe(true);
    expect(isValidLicenseKeyFormat(b)).toBe(true);
    expect(a).not.toBe(b);
    expect(normalizeLicenseKey(`  ${a.toLowerCase()}  `)).toBe(a);
    expect(isValidLicenseKeyFormat("INVALID-KEY")).toBe(false);
  });
});

describe("Flash sales", () => {
  const now = new Date("2026-11-25T12:00:00Z");

  it("activates sale when saleEndsAt is in the future and reverts price when expired", () => {
    const active = {
      priceMinor: 2000,
      salePriceMinor: 1200,
      saleEndsAt: new Date("2026-11-26T15:30:00Z"),
    };
    expect(isSaleActive(active, now)).toBe(true);
    expect(isFlashSaleActive(active, now)).toBe(true);
    expect(getEffectivePriceMinor(active, now)).toBe(1200);
    expect(formatFlashCountdown(active.saleEndsAt, now)).toBe("1d 3h left");

    const expired = {
      priceMinor: 2000,
      salePriceMinor: 1200,
      saleEndsAt: new Date("2026-11-25T11:59:00Z"),
    };
    expect(isSaleActive(expired, now)).toBe(false);
    expect(isFlashSaleActive(expired, now)).toBe(false);
    expect(getEffectivePriceMinor(expired, now)).toBe(2000);
    expect(formatFlashCountdown(expired.saleEndsAt, now)).toBeNull();
  });
});

describe("Seller badges", () => {
  it("awards earned badges strictly from real metrics", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    const badges = computeSellerBadges(
      {
        isApproved: true,
        salesCount: 40,
        publishedProductsCount: 6,
        ratingAverage: 4.9,
        ratingCount: 10,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        hasRecentUpdate: true,
      },
      now,
    );
    expect(badges.map((b) => b.id)).toEqual([
      "verified",
      "top_seller",
      "highly_rated",
      "prolific",
      "established",
      "active_maintainer",
    ]);

    const newbie = computeSellerBadges(
      {
        isApproved: true,
        salesCount: 1,
        publishedProductsCount: 1,
        ratingAverage: 5,
        ratingCount: 2,
        createdAt: new Date("2026-11-20T00:00:00Z"),
      },
      now,
    );
    expect(newbie.map((b) => b.id)).toEqual(["verified"]);
  });
});

describe("Affiliate rules", () => {
  it("normalizes codes and caps affiliate commission at platform fee", () => {
    expect(normalizeAffiliateCode(" luka_2026 ")).toBe("LUKA_2026");
    expect(normalizeAffiliateCode("ab")).toBeNull();
    expect(
      computeAffiliateCommissionMinor({
        orderTotalMinor: 2000,
        platformFeeMinor: 300,
        commissionBps: 1000,
      }),
    ).toBe(200);
    expect(
      computeAffiliateCommissionMinor({
        orderTotalMinor: 2000,
        platformFeeMinor: 150,
        commissionBps: 1000,
      }),
    ).toBe(150);
  });
});
