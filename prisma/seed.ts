/**
 * Database seed.
 *
 * Run with `npm run db:seed` (Prisma runs it through `tsx`, see prisma.config.ts).
 *
 * The seed is intentionally conservative: it creates the catalogue the
 * marketplace needs to be usable at all, and the policy documents that the
 * footer links to. Anything that already exists is left untouched, so running
 * it again never overwrites work an administrator has done in the admin panel.
 */

import { existsSync } from "node:fs";
import path from "node:path";

// Next.js loads .env itself; a standalone script has to do it before any module
// that reads process.env (src/lib/env.ts) is evaluated — hence the dynamic
// imports below rather than static ones.
const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const { prisma } = await import("@/lib/db");
const { seedDefaultCatalog } = await import("@/lib/catalog-seed");
const { LEGAL_PAGES } = await import("@/lib/legal/content");

async function seedCategories() {
  return seedDefaultCatalog(prisma);
}

async function seedLegalPages(): Promise<{ created: number; refreshed: number }> {
  let created = 0;
  let refreshed = 0;

  for (const page of LEGAL_PAGES) {
    const existing = await prisma.legalPage.findUnique({
      where: { slug: page.slug },
      select: { id: true, body: true, updatedById: true },
    });

    if (!existing) {
      await prisma.legalPage.create({
        data: {
          slug: page.slug,
          title: page.title,
          summary: page.summary,
          body: page.body,
          version: page.version,
          isPublished: true,
        },
      });
      created += 1;
      continue;
    }

    // There is no policy editor in the admin panel, so the shipped text is the
    // source of truth — but only for documents nobody has edited. A row with
    // `updatedById` set has been changed on purpose and is never overwritten.
    if (existing.updatedById === null && existing.body !== page.body) {
      await prisma.legalPage.update({
        where: { id: existing.id },
        data: {
          title: page.title,
          summary: page.summary,
          body: page.body,
          version: page.version,
        },
      });
      refreshed += 1;
    }
  }

  return { created, refreshed };
}

/**
 * Promotes already-registered accounts to administrator.
 *
 * There is no way to create an administrator from the UI — which is the point —
 * so the first one is granted here, after that person has registered normally.
 * Set SEED_ADMIN_EMAIL to a comma-separated list of addresses.
 */
async function bootstrapAdmins(): Promise<string> {
  const emails = process.env.SEED_ADMIN_EMAIL?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (!emails || emails.length === 0) {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    return admins > 0
      ? `${admins} administrator account(s) already exist.`
      : "No administrator yet. Register an account, then re-run with SEED_ADMIN_EMAIL set to that address.";
  }

  const results: string[] = [];
  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, username: true, role: true },
    });

    if (!user) {
      results.push(`No account for ${email}`);
      continue;
    }

    if (user.role === "ADMIN") {
      results.push(`@${user.username} is already admin`);
      continue;
    }

    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    results.push(`@${user.username} promoted`);
  }

  return results.join(", ");
}

const catalogSeed = await seedCategories();
const legal = await seedLegalPages();
const adminResult = await bootstrapAdmins();

console.log("Seed complete.");
console.log(
  `  top categories created: ${catalogSeed.parentsCreated} (of ${catalogSeed.totalParents}), subcategories created: ${catalogSeed.subcategoriesCreated} (of ${catalogSeed.totalSubcategories})`,
);
console.log(
  `  legal pages created: ${legal.created}, refreshed from the shipped text: ${legal.refreshed} (of ${LEGAL_PAGES.length})`,
);
console.log(`  administrator: ${adminResult}`);

await prisma.$disconnect();
