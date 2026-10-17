import Link from "next/link";

import { ProductForm } from "@/components/forms/product-forms";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createProductAction } from "@/lib/seller/actions";
import { listActiveCategories } from "@/lib/seller/queries";
import { slugify } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";
export const metadata = { title: "New product · Seller dashboard" };

export default async function NewProductPage() {
  const user = await requireSeller();
  const [categories, globalRule] = await Promise.all([
    listActiveCategories(),
    prisma.commissionRule.findFirst({
      where: { scope: "GLOBAL", isActive: true },
      select: { rateBps: true },
    }),
  ]);

  const commissionBps =
    user.sellerProfile.commissionBps ?? globalRule?.rateBps ?? undefined;
  const keepPercent =
    commissionBps === undefined
      ? null
      : Math.max(0, Math.round((100 - commissionBps / 100) * 100) / 100);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">New product</h1>
        <p className="muted mt-1 text-[12.5px]">
          Create the listing as a draft. You can attach files and images, then submit it for review.
        </p>
      </header>

      {categories.length === 0 ? (
        <Alert tone="error" title="No categories available">
          An administrator has not published any active categories yet, so a product cannot be
          created. Try again once the catalogue is configured.
        </Alert>
      ) : (
        <>
          {keepPercent !== null ? (
            <Alert tone="info" title="Commission">
              The platform commission for your account is configured at{" "}
              {100 - keepPercent}%. You keep {keepPercent}% of each sale, excluding payment
              processing fees charged by Stripe.
            </Alert>
          ) : null}

          <Card>
            <CardHeader
              title="Listing details"
              description="Prices are stored as exact minor units in the currency you choose."
            />
            <CardBody>
              <ProductForm
                action={createProductAction}
                categories={categories}
                submitLabel="Create draft"
                defaults={{
                  title: "",
                  slug: "",
                  categoryId: categories[0]?.id ?? "",
                  shortDescription: "",
                  description: "",
                  price: "",
                  salePrice: "",
                  currency: "EUR",
                  licenseType: "STANDARD",
                  licenseText: "",
                  version: "1.0.0",
                  tags: "",
                  compatibility: "",
                  requirements: "",
                }}
              />
            </CardBody>
          </Card>
        </>
      )}

      <p className="subtle text-[12px]">
        Tip: the product URL is used in links such as{" "}
        <span className="font-mono">/product/{slugify("your-product")}</span>.
      </p>

      <Link href="/dashboard/products" className="btn btn-ghost btn-sm">
        Back to products
      </Link>
    </div>
  );
}
