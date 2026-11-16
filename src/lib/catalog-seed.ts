import type { PrismaClient } from "@prisma/client";

import {
  DEFAULT_PARENT_CATEGORIES,
  DEFAULT_SUBCATEGORIES,
} from "@/lib/catalog-hierarchy";

export type CatalogSeedResult = {
  parentsCreated: number;
  subcategoriesCreated: number;
  totalParents: number;
  totalSubcategories: number;
};

/**
 * Idempotently creates any missing top-level categories and subcategories from
 * the default marketplace catalog hierarchy without overwriting existing rows.
 */
export async function seedDefaultCatalog(db: PrismaClient): Promise<CatalogSeedResult> {
  const parentIdBySlug = new Map<string, string>();
  let parentsCreated = 0;

  for (const [index, category] of DEFAULT_PARENT_CATEGORIES.entries()) {
    const existing = await db.category.findUnique({
      where: { slug: category.slug },
      select: { id: true },
    });
    if (existing) {
      parentIdBySlug.set(category.slug, existing.id);
      continue;
    }

    const created = await db.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        sortOrder: index * 10,
        isActive: true,
      },
      select: { id: true },
    });
    parentIdBySlug.set(category.slug, created.id);
    parentsCreated += 1;
  }

  let subcategoriesCreated = 0;
  for (const [index, sub] of DEFAULT_SUBCATEGORIES.entries()) {
    const parentId = parentIdBySlug.get(sub.parentSlug);
    if (!parentId) continue;

    const existing = await db.category.findUnique({
      where: { slug: sub.slug },
      select: { id: true },
    });
    if (existing) continue;

    await db.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        icon: sub.icon,
        parentId,
        sortOrder: index * 10,
        isActive: true,
      },
    });
    subcategoriesCreated += 1;
  }

  return {
    parentsCreated,
    subcategoriesCreated,
    totalParents: DEFAULT_PARENT_CATEGORIES.length,
    totalSubcategories: DEFAULT_SUBCATEGORIES.length,
  };
}
