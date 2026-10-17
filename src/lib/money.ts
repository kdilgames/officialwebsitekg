/**
 * Money helpers.
 *
 * Every monetary value in this application is stored and computed as an integer
 * number of minor units (cents) in a single currency. Never use floats for money.
 */

const MINOR_UNITS_PER_CURRENCY: Record<string, number> = {
  EUR: 100,
  USD: 100,
  GBP: 100,
  HRK: 100,
};

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW"]);

export function minorUnitFactor(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1;
  return MINOR_UNITS_PER_CURRENCY[code] ?? 100;
}

/** Parse a human-entered price such as "12,50" or "12.5" into minor units. */
export function parseAmountToMinor(input: string, currency = "EUR"): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const factor = minorUnitFactor(currency);
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * factor);
}

export function minorToDecimalString(minor: number, currency = "EUR"): string {
  const factor = minorUnitFactor(currency);
  return (minor / factor).toFixed(factor === 1 ? 0 : 2);
}

export function formatMoney(
  minor: number,
  currency = "EUR",
  options: { locale?: string; showCode?: boolean } = {},
): string {
  const { locale = "en-GB", showCode = false } = options;
  const factor = minorUnitFactor(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: factor === 1 ? 0 : 2,
      maximumFractionDigits: factor === 1 ? 0 : 2,
      currencyDisplay: showCode ? "code" : "symbol",
    }).format(minor / factor);
  } catch {
    return `${minorToDecimalString(minor, currency)} ${currency}`;
  }
}

export function formatCompactMoney(minor: number, currency = "EUR"): string {
  const factor = minorUnitFactor(currency);
  const value = minor / factor;
  if (Math.abs(value) >= 10000) {
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    } catch {
      return formatMoney(minor, currency);
    }
  }
  return formatMoney(minor, currency);
}

export function sumMinor(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
