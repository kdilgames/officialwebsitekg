import { Prisma, type LicenseType } from "@prisma/client";

import { prisma } from "@/lib/db";

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

export const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "best-selling", label: "Best selling" },
  { value: "rating", label: "Highest rated" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export type BrowseParams = {
  q?: string;
  category?: string;
  categoryIds?: string[];
  seller?: string;
  tag?: string;
  license?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  featuredOnly?: boolean;
  perPage?: number;
};

function buildWhere(params: BrowseParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED" };

  if (params.categoryIds && params.categoryIds.length > 0) {
    where.categoryId = { in: params.categoryIds };
  }
  if (params.seller) {
    where.seller = { slug: params.seller };
  }
  if (params.tag) {
    where.tags = { has: params.tag.toLowerCase() };
  }
  if (params.license && LICENSE_TYPES.includes(params.license)) {
    where.licenseType = params.license as LicenseType;
  }
  if (params.featuredOnly) {
    where.isFeatured = true;
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    const priceFilter: Prisma.IntFilter = {};
    if (params.minPrice !== undefined) priceFilter.gte = Math.round(params.minPrice * 100);
    if (params.maxPrice !== undefined) priceFilter.lte = Math.round(params.maxPrice * 100);
    // Sale prices must also be considered, so match either column.
    where.OR = [
      ...(where.OR ?? []),
      { priceMinor: priceFilter },
      { salePriceMinor: priceFilter },
    ];
  }

  const term = params.q?.trim();
  if (term) {
    const search: Prisma.ProductWhereInput = {
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { tags: { has: term.toLowerCase() } },
        { seller: { storeName: { contains: term, mode: "insensitive" } } },
      ],
    };
    // Combine the search with any existing filters without dropping them.
    return { AND: [where, search] };
  }

  return where;
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
