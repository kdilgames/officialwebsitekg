import { formatMoney } from "@/lib/money";

export type CurrencyTotals = Record<string, number>;

export type TotalsSummary = { value: string; hint?: string };

/**
 * Renders a per-currency total for a statistic tile.
 *
 * Amounts held in different currencies are never added together — the field
 * stored on the record decides which currency the money is in, so the preferred
 * (or first) currency is shown and any others are listed separately.
 */
export function formatTotals(totals: CurrencyTotals, preferred = "EUR"): TotalsSummary {
  const entries = Object.entries(totals).filter(([, minor]) => minor !== 0);
  const primary = entries.find(([code]) => code === preferred) ?? entries[0];
  if (!primary) return { value: formatMoney(0, preferred) };

  const summary: TotalsSummary = { value: formatMoney(primary[1], primary[0]) };
  const rest = entries.filter(([code]) => code !== primary[0]);
  if (rest.length > 0) {
    summary.hint = `Also ${rest.map(([code, minor]) => formatMoney(minor, code)).join(", ")}`;
  }
  return summary;
}
