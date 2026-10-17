import Link from "next/link";
import { Heart } from "lucide-react";

import { EmptyState } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductGrid } from "@/components/marketplace/product-card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PRODUCT_CARD_SELECT } from "@/lib/queries/products";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, product: { select: { ...PRODUCT_CARD_SELECT, status: true } } },
  });

  const available = items.filter((item: any) => item.product.status === "PUBLISHED");
  const unavailable = items.length - available.length;

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Heart className="size-5" aria-hidden />}
          title="Your wishlist is empty"
          description="Save products to compare them later. Prices and availability are always read live."
          action={
            <Link href="/browse" className={buttonClass("primary")}>
              Browse products
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Wishlist</h1>
        <p className="muted mt-1 text-[12.5px]">
          {items.length} saved {items.length === 1 ? "product" : "products"}
          {unavailable > 0 ? ` · ${unavailable} no longer available` : ""}
        </p>
      </header>

      {available.length > 0 ? (
        <ProductGrid products={available.map((item: any) => item.product)} />
      ) : (
        <Card>
          <EmptyState
            title="Nothing available right now"
            description="The products you saved are no longer published. They stay here in case they come back."
          />
        </Card>
      )}
    </div>
  );
}
