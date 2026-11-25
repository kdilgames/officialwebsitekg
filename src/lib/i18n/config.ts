export type Locale = "en" | "hr";

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "hr"] as const;
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "kdil-locale";

export function parseLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "hr" || normalized.startsWith("hr-")) return "hr";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

/**
 * Resolves preferred locale (`"hr"` or `"en"`) from an HTTP `Accept-Language`
 * header respecting quality weights (`q=`). Falls back to `"en"`.
 */
export function resolveLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const entries = acceptLanguage
    .split(",")
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const parsedQ = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      const weight = Number.isFinite(parsedQ) ? parsedQ : 0;
      return { tag: (rawTag ?? "").trim().toLowerCase(), weight };
    })
    .filter((entry) => entry.tag.length > 0 && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const entry of entries) {
    const matched = parseLocale(entry.tag);
    if (matched) return matched;
  }

  return DEFAULT_LOCALE;
}
