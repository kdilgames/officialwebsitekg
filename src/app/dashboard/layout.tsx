import Link from "next/link";
import { ExternalLink, Store } from "lucide-react";

import { SellerNav } from "@/components/dashboard/seller-nav";
import { SiteHeader } from "@/components/layout/site-header";
import { StatusBadge } from "@/components/ui/badge";
import { requireSeller } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSeller();
  const seller = user.sellerProfile;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-5 lg:flex-row lg:gap-6 lg:px-5">
        <aside className="lg:w-[196px] lg:shrink-0">
          <div className="surface p-3">
            <div className="flex items-center gap-2">
              <Store className="size-4 shrink-0 text-accent" aria-hidden />
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{seller.storeName}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={seller.status} />
              <Link
                href={`/seller/${seller.slug}`}
                className="flex items-center gap-1 text-[11.5px] text-ink-muted hover:text-ink"
              >
                View store
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="mt-3 lg:sticky lg:top-[68px]">
            <div className="hidden lg:block">
              <SellerNav />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 lg:hidden">
            <SellerNav orientation="horizontal" />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
