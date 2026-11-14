import { Prisma, type LicenseType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { safeHttpUrl } from "@/lib/utils/media";

export const PAGE_SIZE = 24;

export const PRODUCT_CARD_SELECT = {
  slug: true,
  title: true,
  thumbnailUrl: true,
  priceMinor: true,
  salePriceMinor: true,
  currency: true,
  ratingSum: true,
  ratingCount: true,
  salesCount: true,
  category: { select: { name: true, slug: true } },
  seller: { select: { slug: true, storeName: true } },
} satisfies Prisma.ProductSelect;

export type ProductSort =
  | "relevance"
  | "newest"
  | "best-selling"
  | "price-asc"
  | "price-desc"
  | "rating";

export type PriceTier = "free" | "paid" | "on-sale";

export const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "best-selling", label: "Best selling" },
  { value: "rating", label: "Highest rated" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export const PRICE_TIERS: Array<{ value: "" | PriceTier; label: string }> = [
  { value: "", label: "All prices" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "on-sale", label: "On sale" },
];

export type BrowseParams = {
  q?: string;
  category?: string;
  categoryIds?: string[];
  seller?: string;
  tag?: string;
  license?: string;
  priceTier?: PriceTier;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  featuredOnly?: boolean;
  perPage?: number;
};

function buildWhere(params: BrowseParams): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = [{ status: "PUBLISHED" }];

  if (params.categoryIds && params.categoryIds.length > 0) {
    clauses.push({ categoryId: { in: params.categoryIds } });
  }
  if (params.seller) {
    clauses.push({ seller: { slug: params.seller } });
  }
  if (params.tag) {
    clauses.push({ tags: { has: params.tag.toLowerCase() } });
  }
  if (params.license && LICENSE_TYPES.includes(params.license)) {
    clauses.push({ licenseType: params.license as LicenseType });
  }
  if (params.featuredOnly) {
    clauses.push({ isFeatured: true });
  }

  if (params.priceTier === "free") {
    clauses.push({
      OR: [{ salePriceMinor: 0 }, { salePriceMinor: null, priceMinor: 0 }],
    });
  } else if (params.priceTier === "paid") {
    clauses.push({
      OR: [{ salePriceMinor: { gt: 0 } }, { salePriceMinor: null, priceMinor: { gt: 0 } }],
    });
  } else if (params.priceTier === "on-sale") {
    clauses.push({ salePriceMinor: { not: null } });
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    const priceFilter: Prisma.IntFilter = {};
    if (params.minPrice !== undefined) priceFilter.gte = Math.round(params.minPrice * 100);
    if (params.maxPrice !== undefined) priceFilter.lte = Math.round(params.maxPrice * 100);
    clauses.push({
      OR: [
        { salePriceMinor: priceFilter },
        { salePriceMinor: null, priceMinor: priceFilter },
      ],
    });
  }

  const term = params.q?.trim();
  if (term) {
    clauses.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { tags: { has: term.toLowerCase() } },
        { seller: { storeName: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  return clauses.length === 1 ? (clauses[0] as Prisma.ProductWhereInput) : { AND: clauses };
}

function buildOrderBy(sort: ProductSort | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
    case "best-selling":
      return [{ salesCount: "desc" }, { publishedAt: "desc" }];
    case "price-asc":
      return [{ priceMinor: "asc" }, { publishedAt: "desc" }];
    case "price-desc":
      return [{ priceMinor: "desc" }, { publishedAt: "desc" }];
    case "rating":
      return [{ ratingCount: "desc" }, { ratingSum: "desc" }, { publishedAt: "desc" }];
    default:
      return [{ isFeatured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }];
  }
}

const LICENSE_TYPES = ["PERSONAL", "STANDARD", "EXTENDED", "CUSTOM"];

export async function browseProducts(params: BrowseParams) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = params.perPage ?? PAGE_SIZE;
  const where = buildWhere(params);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: PRODUCT_CARD_SELECT,
      orderBy: buildOrderBy(params.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function listCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      parentId: true,
      _count: { select: { products: { where: { status: "PUBLISHED" } } } },
    },
  });
}

/** Category plus every descendant, so a parent page lists child products too. */
export async function categoryWithDescendants(slug: string): Promise<{
  category: { id: string; name: string; slug: string; description: string | null } | null;
  ids: string[];
}> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, description: true },
  });
  if (!category) return { category: null, ids: [] };

  const ids = [category.id];
  const children = await prisma.category.findMany({
    where: { parentId: category.id },
    select: { id: true },
  });
  for (const child of children) {
    ids.push(child.id);
    const grandchildren = await prisma.category.findMany({
      where: { parentId: child.id },
      select: { id: true },
    });
    ids.push(...grandchildren.map((entry) => entry.id));
  }

  return { category, ids };
}

export async function topSellers(limit = 8) {
  return prisma.sellerProfile.findMany({
    where: { status: "APPROVED", user: { status: "ACTIVE" } },
    orderBy: [{ products: { _count: "desc" } }, { createdAt: "asc" }],
    take: limit,
    select: {
      slug: true,
      storeName: true,
      tagline: true,
      logoUrl: true,
      _count: { select: { products: { where: { status: "PUBLISHED" } }, followers: true } },
    },
  });
}

export async function listPublishedBundles(limit = 6, sellerId?: string) {
  return prisma.productBundle.findMany({
    where: {
      isActive: true,
      ...(sellerId ? { sellerId } : {}),
      seller: { status: "APPROVED", user: { status: "ACTIVE" } },
      items: {
        some: {},
        every: { product: { status: "PUBLISHED" } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      bundlePriceMinor: true,
      currency: true,
      seller: { select: { slug: true, storeName: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              priceMinor: true,
              salePriceMinor: true,
              currency: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  });
}

export async function getPublishedBundleBySlug(slug: string) {
  return prisma.productBundle.findFirst({
    where: {
      slug,
      isActive: true,
      seller: { status: "APPROVED", user: { status: "ACTIVE" } },
      items: {
        some: {},
        every: { product: { status: "PUBLISHED" } },
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      bundlePriceMinor: true,
      currency: true,
      sellerId: true,
      seller: {
        select: {
          id: true,
          slug: true,
          storeName: true,
          tagline: true,
          logoUrl: true,
          userId: true,
        },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              shortDescription: true,
              thumbnailUrl: true,
              priceMinor: true,
              salePriceMinor: true,
              currency: true,
              version: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Resolves the optional community Discord invite URL configured by staff in
 * SiteSetting (`community_discord_url`) or via NEXT_PUBLIC_DISCORD_URL.
 */
export async function getCommunityDiscordUrl(): Promise<string | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "community_discord_url" },
      select: { value: true },
    });
    if (typeof setting?.value === "string") {
      const url = safeHttpUrl(setting.value);
      if (url) return url;
    }
  } catch {
    // When DATABASE_URL isn't set during static analysis, fall through to env.
  }
  return safeHttpUrl(env.marketplace.discordUrl);
}
