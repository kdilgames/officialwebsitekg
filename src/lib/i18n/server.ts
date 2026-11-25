import { cookies, headers } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  parseLocale,
  resolveLocaleFromAcceptLanguage,
  type Locale,
} from "./config";

/**
 * Resolves the visitor's active locale (`"en"` or `"hr"`) from the
 * `kdil-locale` cookie first, then the `Accept-Language` request header.
 *
 * Safe to call in static or dynamic renders: falls back to `"en"` when request
 * headers/cookies are unavailable (e.g. during build-time static prerendering).
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const fromCookie = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
    if (fromCookie) return fromCookie;

    const headerList = await headers();
    const fromHeader = parseLocale(headerList.get("x-kdil-locale"));
    if (fromHeader) return fromHeader;

    return resolveLocaleFromAcceptLanguage(headerList.get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
}
