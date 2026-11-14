import Link from "next/link";
import { ExternalLink, Mail } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { BrandMark } from "@/components/layout/brand-mark";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { getAdminQueueCounts } from "@/lib/admin/queries";
import { isOwner, requireAdmin } from "@/lib/auth/session";
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
  const owner = isOwner(user);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-5 lg:flex-row lg:gap-6 lg:px-5">
        <aside className="lg:w-[224px] lg:shrink-0">
          <div className="surface p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <BrandMark size="sm" showName={false} />
                <p className="min-w-0 truncate text-[13px] font-semibold">
                  {env.marketplace.platformName} admin
                </p>
              </div>
              <Badge tone="accent">{owner ? "owner" : "admin"}</Badge>
            </div>

            <p className="mt-2 truncate text-[12px] font-medium text-ink">@{user.username}</p>
            <p className="subtle truncate text-[11.5px]" title={user.email}>
              {user.email}
            </p>

            <div className="divider my-2.5" />

            <div className="flex flex-col gap-1.5">
              <Link
                href="/admin/access"
                className="flex items-center gap-1.5 text-[11.5px] text-ink-muted hover:text-ink"
              >
                <Mail className="size-3" aria-hidden />
                Email access &amp; owner
              </Link>
              <Link
                href="/"
                className="flex items-center gap-1.5 text-[11.5px] text-ink-muted hover:text-ink"
              >
                <ExternalLink className="size-3" aria-hidden />
                Back to storefront
              </Link>
            </div>
          </div>

          <div className="mt-3 lg:sticky lg:top-[78px]">
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
