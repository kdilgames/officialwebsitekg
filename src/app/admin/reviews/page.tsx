import Link from "next/link";
import { Star } from "lucide-react";

import { ActionButton, ReasonForm } from "@/components/admin/action-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import { moderateReviewAction } from "@/lib/admin/actions";
import { listReviewsForModeration } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews · Admin" };

const STATUS_OPTIONS = [
  { value: "PUBLISHED", label: "Published" },
  { value: "HIDDEN", label: "Hidden" },
  { value: "REMOVED", label: "Removed" },
  { value: "ALL", label: "All" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "PUBLISHED";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listReviewsForModeration({ status, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "PUBLISHED") query.set("status", status);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/reviews?${suffix}` : "/admin/reviews";
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Review moderation</h1>
          <p className="muted mt-1 text-[12.5px]">
            Only verified purchases can be reviewed. Removing a published review takes its rating out
            of the product&apos;s public score.
          </p>
        </div>

        <form action="/admin/reviews" className="flex items-center gap-2">
          <label className="label mb-0" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="h-8 w-[160px]">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filter
          </button>
        </form>
      </header>

      <Card>
        <CardHeader
          title={`${result.total} review${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="No reviews match this filter."
            icon={<Star className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {result.items.map((review) => (
              <li key={review.id} className="space-y-3 px-4 py-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-0.5 text-caution" aria-hidden>
                      {Array.from({ length: review.rating }).map((_, index) => (
                        <Star key={index} className="size-3 fill-current" />
                      ))}
                    </span>
                    <span className="text-[13px] font-medium">
                      {review.title ?? "Untitled review"}
                    </span>
                    <StatusBadge status={review.status} />
                    {review.isVerifiedPurchase ? (
                      <Badge tone="positive">verified purchase</Badge>
                    ) : (
                      <Badge tone="caution">unverified</Badge>
                    )}
                  </div>

                  <p className="text-[12px]">
                    On{" "}
                    <Link
                      href={`/product/${review.product.slug}`}
                      className="text-accent hover:underline"
                    >
                      {review.product.title}
                    </Link>{" "}
                    · written by {review.user.displayName} (@{review.user.username}) on{" "}
                    {review.createdAt.toISOString().slice(0, 10)}
                  </p>

                  {review.body ? (
                    <p className="whitespace-pre-wrap text-[12.5px] text-ink-muted">{review.body}</p>
                  ) : null}

                  {review.sellerReply ? (
                    <div className="surface-elevated p-2.5">
                      <p className="subtle text-[11px] font-medium uppercase tracking-[0.04em]">
                        Seller reply
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[12.5px]">{review.sellerReply}</p>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-start gap-2">
                  {review.status === "PUBLISHED" ? (
                    <ActionButton
                      action={moderateReviewAction}
                      fields={{ reviewId: review.id, status: "HIDDEN" }}
                      confirm="Hide this review from the product page?"
                    >
                      Hide
                    </ActionButton>
                  ) : (
                    <ActionButton
                      action={moderateReviewAction}
                      fields={{ reviewId: review.id, status: "PUBLISHED" }}
                      variant="primary"
                      confirm="Publish this review on the product page?"
                    >
                      Publish
                    </ActionButton>
                  )}

                  {review.status !== "REMOVED" ? (
                    <ReasonForm
                      action={moderateReviewAction}
                      fields={{ reviewId: review.id, status: "REMOVED" }}
                      label="Remove"
                      submitLabel="Remove review"
                      placeholder="Why is this review being removed? The reason is recorded in the audit log."
                      confirm="Remove this review permanently?"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </div>
  );
}
