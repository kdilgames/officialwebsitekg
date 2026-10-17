import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileWarning } from "lucide-react";

import { ActionButton, ReasonForm } from "@/components/admin/action-forms";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  approveProductAction,
  rejectProductAction,
  suspendProductAction,
  toggleFeaturedProductAction,
} from "@/lib/admin/actions";
import { getProductModerationDetail } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await getProductModerationDetail(productId);
  if (!product) notFound();

  const activeFiles = product.files.filter((file) => file.isActive);
  const scanBlocked = activeFiles.filter(
    (file) => file.scanStatus === "INFECTED" || file.scanStatus === "PENDING",
  );
  const canApprove = activeFiles.length > 0 && product.seller.status === "APPROVED";

  return (
    <div className="space-y-4">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to moderation
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-semibold tracking-tight">{product.title}</h1>
            <StatusBadge status={product.status} />
            {product.isFeatured ? <Badge tone="accent">featured</Badge> : null}
          </div>
          <p className="muted mt-1 text-[12.5px]">
            {product.category.name} ·{" "}
            <Link href={`/seller/${product.seller.slug}`} className="hover:text-accent">
              {product.seller.storeName}
            </Link>{" "}
            <StatusBadge status={product.seller.status} /> · {product.licenseType.toLowerCase()}{" "}
            license
          </p>
          <p className="subtle mt-0.5 font-mono text-[11.5px]">{product.slug}</p>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          {product.status === "PENDING_REVIEW" && canApprove ? (
            <ActionButton
              action={approveProductAction}
              fields={{ productId: product.id }}
              variant="primary"
              confirm="Publish this listing to the storefront?"
            >
              Approve &amp; publish
            </ActionButton>
          ) : null}
          {product.status === "PENDING_REVIEW" ? (
            <ReasonForm
              action={rejectProductAction}
              fields={{ productId: product.id }}
              label="Reject"
              submitLabel="Reject listing"
              placeholder="What must the seller change?"
              confirm="Reject this listing?"
            />
          ) : null}
          {product.status !== "SUSPENDED" ? (
            <ReasonForm
              action={suspendProductAction}
              fields={{ productId: product.id }}
              label="Remove"
              submitLabel="Remove listing"
              placeholder="Why is this listing being taken down?"
              confirm="Remove this listing from the storefront?"
            />
          ) : null}
          {product.status === "PUBLISHED" ? (
            <ActionButton
              action={toggleFeaturedProductAction}
              fields={{ productId: product.id }}
            >
              {product.isFeatured ? "Unfeature" : "Feature"}
            </ActionButton>
          ) : null}
        </div>
      </header>

      {!canApprove ? (
        <Alert tone="warning" title="This listing cannot be published yet">
          {activeFiles.length === 0
            ? "There is no active delivery file, so a buyer would have nothing to download."
            : "The seller account is not approved, so its listings cannot go live."}
        </Alert>
      ) : null}

      {scanBlocked.length > 0 ? (
        <Alert tone="error" title="Delivery files are not cleared">
          {scanBlocked.length} active file{scanBlocked.length === 1 ? " has" : "s have"} a scan
          status of pending or infected. Buyers must not receive these.
        </Alert>
      ) : null}

      {product.rejectionReason ? (
        <Alert tone="info" title="Last moderation reason">
          {product.rejectionReason}
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Listing copy" description="What a buyer reads on the product page." />
            <CardBody className="space-y-3">
              {product.shortDescription ? (
                <p className="text-[13px] text-ink">{product.shortDescription}</p>
              ) : null}
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted">
                {product.description}
              </p>
              {product.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              ) : null}
              {product.licenseText ? (
                <details>
                  <summary className="cursor-pointer text-[12px] text-ink-muted hover:text-ink">
                    License terms
                  </summary>
                  <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] text-ink-muted">
                    {product.licenseText}
                  </p>
                </details>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Delivery files"
              description="Private objects. Customers receive expiring signed links, never a public URL."
            />
            {product.files.length === 0 ? (
              <CardBody>
                <p className="flex items-center gap-2 text-[12.5px] text-critical">
                  <FileWarning className="size-4" aria-hidden />
                  No files uploaded.
                </p>
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Size</th>
                      <th>Scan</th>
                      <th>State</th>
                      <th>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.files.map((file) => (
                      <tr key={file.id}>
                        <td className="max-w-[260px]">
                          <span className="block truncate font-medium">{file.fileName}</span>
                          <span className="subtle text-[11.5px]">{file.mimeType}</span>
                          {file.scanNote ? (
                            <span className="mt-0.5 block text-[11.5px] text-caution">
                              {file.scanNote}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap tabular-nums">
                          {formatBytes(file.sizeBytes)}
                        </td>
                        <td>
                          <StatusBadge status={file.scanStatus} />
                        </td>
                        <td>
                          <Badge tone={file.isActive ? "positive" : "neutral"}>
                            {file.isActive ? "active" : "inactive"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap text-[11.5px] text-ink-muted">
                          {file.createdAt.toISOString().slice(0, 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Versions" description="Previous purchasers receive updates." />
            {product.versions.length === 0 ? (
              <CardBody>
                <p className="muted text-[12.5px]">No versions recorded.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {product.versions.map((version) => (
                  <li key={version.id} className="space-y-1 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-medium">
                        {version.version}
                      </span>
                      {version.isLatest ? <Badge tone="accent">latest</Badge> : null}
                      <span className="subtle ml-auto text-[11.5px]">
                        {version.releasedAt.toISOString().slice(0, 10)}
                      </span>
                    </div>
                    {version.changelog ? (
                      <p className="whitespace-pre-wrap text-[12.5px] text-ink-muted">
                        {version.changelog}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Gallery" description={`${product.images.length} image(s)`} />
          <CardBody>
            {product.images.length === 0 ? (
              <p className="muted text-[12.5px]">No images attached.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {product.images.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
                  <img
                    key={image.id}
                    src={image.url}
                    alt={image.alt ?? ""}
                    className="aspect-[4/3] w-full rounded-[7px] border border-line object-cover"
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
