/**
 * EU VAT / Stripe Tax helpers.
 *
 * Stripe Tax handles real-time EU VAT calculation, reverse-charge validation,
 * and OSS reporting during Checkout when `STRIPE_AUTOMATIC_TAX=true` and Stripe
 * Tax is activated on the platform Stripe account.
 */

export const EU_VAT_STANDARD_RATES: Readonly<Record<string, number>> = {
  AT: 20,
  BE: 21,
  BG: 20,
  CY: 19,
  CZ: 21,
  DE: 19,
  DK: 25,
  EE: 22,
  ES: 21,
  FI: 25.5,
  FR: 20,
  GR: 24,
  HR: 25,
  HU: 27,
  IE: 23,
  IT: 22,
  LT: 21,
  LU: 17,
  LV: 21,
  MT: 18,
  NL: 21,
  PL: 23,
  PT: 23,
  RO: 19,
  SE: 25,
  SI: 22,
  SK: 23,
};

/** Default Stripe Tax code for Electronically Supplied Services / Digital Goods. */
export const DEFAULT_DIGITAL_TAX_CODE = "txcd_10000000";

export function isEuCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return countryCode.trim().toUpperCase() in EU_VAT_STANDARD_RATES;
}

export function getEuVatRatePercent(countryCode: string | null | undefined): number | null {
  if (!countryCode) return null;
  const code = countryCode.trim().toUpperCase();
  return EU_VAT_STANDARD_RATES[code] ?? null;
}

/**
 * Detects Stripe errors thrown when `automatic_tax` is enabled in env vars but
 * Stripe Tax has not been activated/configured in the Stripe Dashboard yet, so
 * checkout can gracefully retry without automatic_tax instead of failing hard.
 */
export function isStripeTaxNotConfiguredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";
  const code = "code" in error && typeof error.code === "string" ? error.code.toLowerCase() : "";

  if (code.includes("tax_settings") || code.includes("automatic_tax")) return true;
  return (
    message.includes("automatic tax") ||
    message.includes("automatic_tax") ||
    message.includes("stripe tax") ||
    message.includes("head office") ||
    message.includes("tax_id_collection")
  );
}

export function extractCheckoutTaxDetails(session: {
  total_details?: { amount_tax?: number | null } | null;
  customer_details?: {
    address?: { country?: string | null } | null;
    tax_ids?: Array<{ value?: string | null }> | null;
  } | null;
}): {
  taxMinor: number;
  billingCountry: string | null;
  customerTaxId: string | null;
} {
  const rawTax = session.total_details?.amount_tax;
  const taxMinor = typeof rawTax === "number" && Number.isFinite(rawTax) && rawTax > 0 ? Math.round(rawTax) : 0;

  const rawCountry = session.customer_details?.address?.country?.trim().toUpperCase();
  const billingCountry = rawCountry && /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null;

  const rawTaxId = session.customer_details?.tax_ids?.find((entry) => entry?.value)?.value?.trim();
  const customerTaxId = rawTaxId && rawTaxId.length > 0 ? rawTaxId.slice(0, 64) : null;

  return { taxMinor, billingCountry, customerTaxId };
}
