import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CategoryNavBar } from "@/components/layout/category-nav-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { withSchemaFallback } from "@/lib/db-compat";
import { listCategories } from "@/lib/queries/products";
import { getSiteAnnouncement } from "@/lib/settings";

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const [announcement, categories] = await Promise.all([
    getSiteAnnouncement(),
    withSchemaFallback(() => listCategories(), []),
  ]);

  const barClasses =
    announcement?.tone === "positive"
      ? "border-b border-positive/20 bg-positive-quiet text-positive-ink"
      : announcement?.tone === "accent"
        ? "border-b border-accent/20 bg-accent-quiet text-accent-ink"
        : "border-b border-line bg-elevated text-ink";

  return (
    <div className="flex min-h-screen flex-col">
      {announcement ? (
        <div className={barClasses}>
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-4 py-2 text-center text-[12.5px] sm:px-6">
            <span>{announcement.text}</span>
            {announcement.href ? (
              <Link
                href={announcement.href}
                className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80"
              >
                {announcement.linkLabel || "Learn more"}
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <SiteHeader />
      <CategoryNavBar categories={categories} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

