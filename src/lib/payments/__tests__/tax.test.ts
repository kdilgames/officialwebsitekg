import { describe, expect, it } from "vitest";

import {
  extractCheckoutTaxDetails,
  getEuVatRatePercent,
  isEuCountry,
  isStripeTaxNotConfiguredError,
} from "../tax";

describe("EU VAT helpers", () => {
  it("recognizes EU member states and returns standard VAT rates", () => {
    expect(isEuCountry("HR")).toBe(true);
    expect(isEuCountry("de")).toBe(true);
    expect(isEuCountry("US")).toBe(false);
    expect(isEuCountry(null)).toBe(false);
    expect(getEuVatRatePercent("HR")).toBe(25);
    expect(getEuVatRatePercent("DE")).toBe(19);
    expect(getEuVatRatePercent("US")).toBeNull();
  });

  it("detects Stripe Tax unconfigured errors for graceful checkout fallback", () => {
    expect(
      isStripeTaxNotConfiguredError(
        new Error("Stripe Tax has not been activated on your account."),
      ),
    ).toBe(true);
    expect(
      isStripeTaxNotConfiguredError({
        code: "tax_settings_not_active",
        message: "Configure head office address",
      }),
    ).toBe(true);
    expect(isStripeTaxNotConfiguredError(new Error("Your card was declined."))).toBe(false);
  });

  it("extracts tax amount, billing country, and EU VAT ID from a Checkout Session", () => {
    const details = extractCheckoutTaxDetails({
      total_details: { amount_tax: 250 },
      customer_details: {
        address: { country: "hr" },
        tax_ids: [{ value: "HR12345678901" }],
      },
    });
    expect(details).toEqual({
      taxMinor: 250,
      billingCountry: "HR",
      customerTaxId: "HR12345678901",
    });

    expect(extractCheckoutTaxDetails({})).toEqual({
      taxMinor: 0,
      billingCountry: null,
      customerTaxId: null,
    });
  });
});
