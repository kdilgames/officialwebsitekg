import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Store } from "lucide-react";

import { EmptyState } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sellers" };

export default async function SellersPage() {
  const sellers = await prisma.sellerProfile.findMany({
    where: { status: "APPROVED", user: { status: "ACTIVE" } },
    orderBy: [{ products: { _count: "desc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      storeName: true,
      tagline: true,
      logoUrl: true,
      about: true,
      country: true,
      _count: { select: { products: { where: { status: "PUBLISHED" } }, followers: true } },
    },
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink">Verified sellers</h1>
          <p className="muted mt-1.5 max-w-2xl text-[14px]">
            Independent developers, teams, and studios reviewed and approved to publish on KDILGAMES.
          </p>
        </div>
        <Link href="/account/seller" className="btn btn-secondary btn-sm">
          <Store className="size-4" aria-hidden />
          Open a seller store
        </Link>
      </header>

      {sellers.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<Store className="size-5" aria-hidden />}
            title="No seller stores live yet"
            description="Creator applications are open. Approved stores and their listings will appear here."
            action={
              <Link href="/account/seller" className="btn btn-primary btn-sm">
                Apply to become a seller
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sellers.map((seller) => (
            <Card key={seller.id} as="article" className="card-interactive flex flex-col">
              <CardBody className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-3.5">
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-elevated text-[15px] font-semibold text-ink">
                    {seller.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                      <img src={seller.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      seller.storeName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/seller/${seller.slug}`}
                      className="flex items-center gap-1.5 text-[15px] font-semibold text-ink hover:text-accent"
                    >
                      <span className="truncate">{seller.storeName}</span>
                      <BadgeCheck className="size-4 shrink-0 text-accent" aria-hidden />
                    </Link>
                    <p className="subtle mt-0.5 text-[12px] tabular-nums">
                      {seller._count.products}{" "}
                      {seller._count.products === 1 ? "product" : "products"} ·{" "}
                      {seller._count.followers}{" "}
                      {seller._count.followers === 1 ? "follower" : "followers"}
                    </p>
                  </div>
                </div>

                <p className="muted mt-4 line-clamp-3 text-[13px] leading-relaxed">
                  {seller.tagline ??
                    seller.about ??
                    "Digital products, code, and game development assets."}
                </p>

                <div className="mt-auto pt-4">
                  <Link
                    href={`/seller/${seller.slug}`}
                    className="btn btn-secondary btn-sm w-full justify-between"
                  >
                    <span>Visit store</span>
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
