/**
 * Pure request-origin resolution helpers used for Stripe return URLs and
 * authentication callback URLs. Kept free of Next.js imports so unit tests can
 * verify header handling directly.
 */

const SAFE_HOST_PATTERN =
  /^(?:\[[a-f0-9:]+\]|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)(?::\d{1,5})?$/i;

function firstHeaderValue(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

function isLoopbackHost(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(host);
}

function isPublicHttpsOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && !isLoopbackHost(parsed.host);
  } catch {
    return false;
  }
}

export function resolveOriginFromHeaders(params: {
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
  fallbackOrigin: string;
}): string {
  const candidateHost =
    firstHeaderValue(params.forwardedHost) ?? firstHeaderValue(params.host);

  if (!candidateHost || !SAFE_HOST_PATTERN.test(candidateHost)) {
    return params.fallbackOrigin;
  }

  if (isLoopbackHost(candidateHost) && isPublicHttpsOrigin(params.fallbackOrigin)) {
    return params.fallbackOrigin;
  }

  const rawProto = firstHeaderValue(params.forwardedProto)?.toLowerCase();
  const proto =
    rawProto === "http" || rawProto === "https"
      ? rawProto
      : isLoopbackHost(candidateHost)
        ? "http"
        : "https";

  return `${proto}://${candidateHost}`;
}
