import Link from "next/link";
import { BadgeCheck, MessageSquare, Star } from "lucide-react";

import { ReviewReplyForm } from "@/components/dashboard/review-reply-form";
import { EmptyState } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { requireSeller } from "@/lib/auth/session";
import { sellerReplyAction } from "@/lib/marketplace/actions";
import { listSellerReviews } from "@/lib/seller/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews · Seller dashboard" };

export default async function DashboardReviewsPage() {
  const user = await requireSeller();
  const seller = user.sellerProfile;
  const reviews = await listSellerReviews(seller.id);

  const published = reviews.filter((review) => review.status === "PUBLISHED");
  const average =
    published.length > 0
      ? published.reduce((total, review) => total + review.rating, 0) / published.length
      : null;
  const unanswered = published.filter((review) => !review.sellerReply).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[18px] font-semibold tracking-tight">Reviews</h1>
        <p className="muted mt-1 text-[12.5px]">
          Only buyers with a settled purchase can review, and reviews are never edited or deleted by
          the seller.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Average rating"
          value={average === null ? "—" : average.toFixed(2)}
          hint={`${published.length} published review${published.length === 1 ? "" : "s"}`}
          icon={<Star className="size-4" aria-hidden />}
        />
        <StatCard
          label="Awaiting reply"
          value={unanswered.toLocaleString("en-GB")}
          hint="Replying publicly builds buyer confidence"
          icon={<MessageSquare className="size-4" aria-hidden />}
        />
        <StatCard
          label="Verified purchases"
          value={published.filter((review) => review.isVerifiedPurchase).length.toLocaleString("en-GB")}
          hint="Reviews linked to a paid order line"
          icon={<BadgeCheck className="size-4" aria-hidden />}
        />
      </section>

      {reviews.length === 0 ? (
        <Card>
          <EmptyState
            title="No reviews yet"
            description="Reviews appear here once buyers rate a product they purchased."
            icon={<Star className="size-5" aria-hidden />}
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card>
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-0.5 text-caution">
                        {Array.from({ length: review.rating }).map((_, index) => (
                          <Star key={index} className="size-3.5 fill-current" aria-hidden />
                        ))}
                      </span>
                      <Link
                        href={`/product/${review.product.slug}`}
                        className="text-[13px] hover:text-accent"
                      >
                        {review.product.title}
                      </Link>
                    </span>
                  }
                  description={`${review.user.displayName} · ${review.createdAt.toISOString().slice(0, 10)}`}
                  actions={
                    <div className="flex items-center gap-2">
                      {review.isVerifiedPurchase ? <StatusBadge status="APPROVED" /> : null}
                      <StatusBadge status={review.status} />
                    </div>
                  }
                />
                <CardBody className="space-y-3">
                  {review.title ? (
                    <p className="text-[13px] font-medium">{review.title}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-[12.5px] text-ink-muted">{review.body}</p>

                  {review.sellerReply ? (
                    <div className="border-l-2 border-line pl-3">
                      <p className="subtle text-[11.5px]">
                        Your reply ·{" "}
                        {review.sellerRepliedAt
                          ? review.sellerRepliedAt.toISOString().slice(0, 10)
                          : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[12.5px]">
                        {review.sellerReply}
                      </p>
                    </div>
                  ) : null}

                  <ReviewReplyForm
                    action={sellerReplyAction}
                    reviewId={review.id}
                    defaultValue={review.sellerReply ?? ""}
                  />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
