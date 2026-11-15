import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { LEGAL_PAGES } from "@/lib/legal/content";
import { getRequestOrigin } from "@/lib/utils/origin";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (await getRequestOrigin()).replace(/\/+$/, "");
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/browse`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${origin}/sellers`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${origin}/support`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${origin}/report`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const legalSlugs = new Set<string>(LEGAL_PAGES.map((page) => page.slug));

  try {
    const [products, categories, sellers, bundles, dbLegalPages] = await Promise.all([
      prisma.product.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: { slug: true, updatedAt: true },
        take: 5000,
      }),
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.sellerProfile.findMany({
        where: { status: "APPROVED" },
        orderBy: { updatedAt: "desc" },
        select: { slug: true, updatedAt: true },
        take: 1000,
      }),
      withSchemaFallback(
        () =>
          prisma.productBundle.findMany({
            where: { isActive: true, items: { some: {} } },
            orderBy: { updatedAt: "desc" },
            select: { slug: true, updatedAt: true },
            take: 1000,
          }),
        [],
      ),
      prisma.legalPage.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    for (const category of categories) {
      entries.push({
        url: `${origin}/category/${category.slug}`,
        lastModified: category.updatedAt,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }

    for (const product of products) {
      entries.push({
        url: `${origin}/product/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const bundle of bundles) {
      entries.push({
        url: `${origin}/bundle/${bundle.slug}`,
        lastModified: bundle.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const seller of sellers) {
      entries.push({
        url: `${origin}/seller/${seller.slug}`,
        lastModified: seller.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    const dbLegalMap = new Map(dbLegalPages.map((row) => [row.slug, row.updatedAt]));
    for (const page of dbLegalPages) legalSlugs.add(page.slug);
    for (const slug of legalSlugs) {
      entries.push({
        url: `${origin}/legal/${slug}`,
        lastModified: dbLegalMap.get(slug) ?? now,
        changeFrequency: "monthly",
        priority: 0.3,
      });
    }
  } catch {
    // Graceful fallback so offline/dummy-DB builds or transient outages still return static URLs.
    for (const slug of legalSlugs) {
      entries.push({
        url: `${origin}/legal/${slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.3,
      });
    }
  }

  return entries;
}
