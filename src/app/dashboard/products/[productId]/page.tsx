import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ExternalLink, Send, Trash2 } from "lucide-react";

import {
  ProductFilesPanel,
  ProductImagesPanel,
  type AssetFile,
  type AssetImage,
} from "@/components/dashboard/asset-manager";
import { ProductForm, VersionForm } from "@/components/forms/product-forms";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { bpsToPercent, formatBps, resolveCommissionRate } from "@/lib/commission";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMoney, minorToDecimalString } from "@/lib/money";
import {
  archiveProductAction,
  createVersionAction,
  deleteProductAction,
  submitProductForReviewAction,
  updateProductAction,
} from "@/lib/seller/actions";
import { getSellerProduct, listActiveCategories } from "@/lib/seller/queries";

export const dynamic = "force-dynamic";

function jsonToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.note === "string") return record.note;
  }
  return value ? JSON.stringify(value, null, 2) : "";
}

export default async function ManageProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const user = await requireSeller();
  const seller = user.sellerProfile;
  const { productId } = await params;

  const [product, categories, rules] = await Promise.all([
    getSellerProduct(seller.id, productId),
    listActiveCategories(),
    prisma.commissionRule.findMany({
      where: { isActive: true },
      select: { scope: true, targetId: true, rateBps: true, isActive: true },
    }),
  ]);

  if (!product) notFound();

  const rate = resolveCommissionRate({
    productId: product.id,
    categoryId: product.categoryId,
    sellerId: seller.id,
    sellerCommissionBps: seller.commissionBps,
    rules,
  });
  const keepPercent = Math.max(0, Math.round((100 - bpsToPercent(rate.rateBps)) * 100) / 100);
  const unitPriceMinor = product.salePriceMinor ?? product.priceMinor;
  const netPerSale = Math.round((unitPriceMinor * (10_000 - rate.rateBps)) / 10_000);

  const activeFiles = product.files.filter((file) => file.isActive);
  const canSubmit = ["DRAFT", "REJECTED", "ARCHIVED"].includes(product.status) && activeFiles.length > 0;
  const canDelete = product.salesCount === 0 && ["DRAFT", "REJECTED", "ARCHIVED"].includes(product.status);

  const files: AssetFile[] = product.files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    sizeBytes: file.sizeBytes,
    mimeType: file.mimeType,
    scanStatus: file.scanStatus,
    scanNote: file.scanNote,
    isActive: file.isActive,
    createdAt: file.createdAt.toISOString(),
    downloads: file._count.downloads,
    versionId: file.versionId,
  }));

  const images: AssetImage[] = product.images.map((image) => ({
    id: image.id,
    url: image.url,
    alt: image.alt,
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[18px] font-semibold tracking-tight">{product.title}</h1>
            <StatusBadge status={product.status} />
          </div>
          <p className="muted mt-1 text-[12.5px]">
            {product.categoryId ? categories.find((entry) => entry.id === product.categoryId)?.name : ""}{" "}
            · version {product.version} · updated {product.updatedAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {product.status === "PUBLISHED" ? (
            <Link href={`/product/${product.slug}`} className={buttonClass("secondary", "sm")}>
              <ExternalLink className="size-3.5" aria-hidden />
              View listing
            </Link>
          ) : null}
          <Link href="/dashboard/products" className="btn btn-ghost btn-sm">
            All products
          </Link>
        </div>
      </header>

      {product.status === "PENDING_REVIEW" ? (
        <Alert tone="info" title="Waiting for review">
          A platform administrator approves or rejects listings. You cannot publish your own product.
        </Alert>
      ) : null}

      {product.status === "REJECTED" ? (
        <Alert tone="error" title="Changes requested">
          {product.rejectionReason ?? "No reason was recorded."} Update the listing and submit it
          again when it is ready.
        </Alert>
      ) : null}

      {product.status === "SUSPENDED" ? (
        <Alert tone="error" title="Listing suspended">
          Platform staff removed this listing from the marketplace. Contact support for details.
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales" value={product.salesCount.toLocaleString("en-GB")} />
        <StatCard label="Views" value={product.viewCount.toLocaleString("en-GB")} />
        <StatCard
          label="Rating"
          value={
            product.ratingCount > 0
              ? (product.ratingSum / product.ratingCount).toFixed(2)
              : "—"
          }
          hint={`${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="You earn"
          value={formatMoney(netPerSale, product.currency)}
          tone="positive"
          hint={`Per sale · commission ${formatBps(rate.rateBps)} (${keepPercent}% to you)`}
        />
      </section>

      <Card>
        <CardHeader
          title="Listing details"
          description="Editing a published product sends it back to review before it goes live again."
        />
        <CardBody>
          <ProductForm
            action={updateProductAction}
            categories={categories}
            productId={product.id}
            submitLabel="Save changes"
            defaults={{
              title: product.title,
              slug: product.slug,
              categoryId: product.categoryId,
              shortDescription: product.shortDescription,
              description: product.description,
              price: minorToDecimalString(product.priceMinor, product.currency),
              salePrice:
                product.salePriceMinor === null
                  ? ""
                  : minorToDecimalString(product.salePriceMinor, product.currency),
              currency: product.currency,
              licenseType: product.licenseType,
              licenseText: product.licenseText ?? "",
              version: product.version,
              tags: product.tags.join(", "),
              compatibility: jsonToText(product.compatibility),
              requirements: jsonToText(product.requirements),
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Files"
          description="The files a buyer receives. Stored privately and served through short-lived signed links."
        />
        <CardBody>
          <ProductFilesPanel
            productId={product.id}
            productName={product.title}
            files={files}
            versions={product.versions.map((version) => ({
              id: version.id,
              version: version.version,
              isLatest: version.isLatest,
            }))}
            maxBytes={env.uploads.maxFileBytes}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Images" description="Shown on the listing and in search results." />
        <CardBody>
          <ProductImagesPanel
            productId={product.id}
            images={images}
            maxImages={env.uploads.maxImagesPerProduct}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Versions"
          description="Buyers keep access to updates for products they own."
        />
        <CardBody className="space-y-4">
          {product.versions.length === 0 ? (
            <p className="muted text-[12.5px]">No versions recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {product.versions.map((version) => (
                <li
                  key={version.id}
                  className="surface-elevated flex flex-wrap items-start justify-between gap-2 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      {version.version}
                      {version.isLatest ? (
                        <span className="badge badge-accent">latest</span>
                      ) : null}
                    </p>
                    <p className="muted mt-1 whitespace-pre-wrap text-[12.5px]">
                      {version.changelog}
                    </p>
                  </div>
                  <span className="subtle shrink-0 text-[11.5px]">
                    {version.releasedAt.toISOString().slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="divider" />
          <VersionForm action={createVersionAction} productId={product.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Publishing" description="Lifecycle actions for this listing." />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {canSubmit ? (
              <form action={submitProductForReviewAction}>
                <input type="hidden" name="productId" value={product.id} />
                <Button type="submit" variant="primary" size="sm">
                  <Send className="size-3.5" aria-hidden />
                  Submit for review
                </Button>
              </form>
            ) : null}

            {product.status === "PUBLISHED" || product.status === "PENDING_REVIEW" ? (
              <form action={archiveProductAction}>
                <input type="hidden" name="productId" value={product.id} />
                <Button type="submit" variant="secondary" size="sm">
                  <Archive className="size-3.5" aria-hidden />
                  Archive listing
                </Button>
              </form>
            ) : null}
          </div>

          {!canSubmit && activeFiles.length === 0 ? (
            <Alert tone="warning" title="Attach a file first">
              A listing without a downloadable file cannot be submitted for review.
            </Alert>
          ) : null}

          {canDelete ? (
            <form action={deleteProductAction} className="border-t border-line pt-4">
              <input type="hidden" name="productId" value={product.id} />
              <p className="muted text-[12.5px]">
                This draft has never been sold, so it can be deleted permanently along with its
                stored files.
              </p>
              <Button type="submit" variant="danger" size="sm" className="mt-2">
                <Trash2 className="size-3.5" aria-hidden />
                Delete product
              </Button>
            </form>
          ) : (
            <p className="subtle border-t border-line pt-4 text-[12px]">
              Products that have been sold cannot be deleted, so buyers keep their downloads.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
