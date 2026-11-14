import { headers } from "next/headers";

import { env } from "@/lib/env";
import { resolveOriginFromHeaders } from "@/lib/utils/origin-rules";

/**
 * Resolves the canonical origin of the current request so Stripe return URLs
 * and email auth callbacks match the live domain even when SITE_URL is unset.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  return resolveOriginFromHeaders({
    forwardedHost: headerList.get("x-forwarded-host"),
    host: headerList.get("host"),
    forwardedProto: headerList.get("x-forwarded-proto"),
    fallbackOrigin: env.siteUrl,
  });
}
