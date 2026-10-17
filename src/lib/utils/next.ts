/**
 * Only same-origin paths are accepted, so a `next` query parameter cannot be
 * used for open redirects.
 */
export function safeNext(value: string | null | undefined, fallback = "/account"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
