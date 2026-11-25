import type { MetadataRoute } from "next";

import { getRequestOrigin } from "@/lib/utils/origin";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = (await getRequestOrigin()).replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/account",
          "/account/",
          "/cart",
          "/checkout",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
