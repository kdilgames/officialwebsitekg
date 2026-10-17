import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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
    <div className="mx-auto max-w-[1400px] px-4 py-7">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Sellers</h1>
        <p className="muted mt-1 text-[13px]">
          Every store listed here was reviewed and approved by platform staff before publishing.
        </p>
      </header>

      {sellers.length === 0 ? (
        <div className="surface">
          <EmptyState
            title="No approved sellers yet"
            description="Stores appear once an application is approved. Sellers cannot approve themselves."
            action={
              <Link href="/account/seller" className="btn btn-secondary btn-sm">
                Apply to become a seller
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sellers.map((seller) => (
            <Card key={seller.id} as="article" className="flex flex-col">
              <CardHeader
                title={
                  <Link href={`/seller/${seller.slug}`} className="hover:text-accent">
                    {seller.storeName}
                  </Link>
                }
                description={`${seller._count.products} products · ${seller._count.followers} followers`}
                actions={<BadgeCheck className="size-4 text-accent" aria-hidden />}
              />
              <CardBody className="flex flex-1 flex-col gap-3">
                {seller.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                  <img
                    src={seller.logoUrl}
                    alt=""
                    className="h-16 w-full rounded-[7px] border border-line object-cover"
                  />
                ) : null}
                <p className="muted line-clamp-4 text-[12.5px] leading-relaxed">
                  {seller.tagline ?? seller.about ?? "This seller has not added a description yet."}
                </p>
                <Link href={`/seller/${seller.slug}`} className="btn btn-secondary btn-sm mt-auto">
                  View store
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
