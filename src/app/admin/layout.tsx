import Link from "next/link";
import { ExternalLink, Shield } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { SiteHeader } from "@/components/layout/site-header";
import { getAdminQueueCounts } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Administration" };

/**
 * Every page below this layout is administrator-only. `requireAdmin()` resolves
 * the role from the database on each request, so the route cannot be reached by
 * a signed-in buyer or seller even with a hand-crafted URL.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const counts = await getAdminQueueCounts();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-5 lg:flex-row lg:gap-6 lg:px-5">
        <aside className="lg:w-[200px] lg:shrink-0">
          <div className="surface p-3">
            <div className="flex items-center gap-2">
              <Shield className="size-4 shrink-0 text-accent" aria-hidden />
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {env.marketplace.platformName} admin
              </p>
            </div>
            <p className="muted mt-1.5 truncate text-[11.5px]">
              @{user.username} · {user.role.toLowerCase()}
            </p>
            <Link
              href="/"
              className="mt-2 flex items-center gap-1 text-[11.5px] text-ink-muted hover:text-ink"
            >
              Back to storefront
              <ExternalLink className="size-3" aria-hidden />
            </Link>
          </div>

          <div className="mt-3 lg:sticky lg:top-[68px]">
            <div className="hidden lg:block">
              <AdminNav counts={counts} />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 lg:hidden">
            <AdminNav counts={counts} orientation="horizontal" />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
