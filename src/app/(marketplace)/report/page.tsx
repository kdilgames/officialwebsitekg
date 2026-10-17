import type { Metadata } from "next";
import Link from "next/link";
import { Copyright, Flag, LifeBuoy } from "lucide-react";

import { ReportForm } from "@/components/marketplace/product-actions";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { reportContentAction } from "@/lib/marketplace/actions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Report content",
  description: "Report a listing, a user or a review to platform staff.",
};

type TargetType = "PRODUCT" | "USER" | "REVIEW";

function parseTarget(type?: string, id?: string): { targetType: TargetType; targetId: string } | null {
  const allowed: TargetType[] = ["PRODUCT", "USER", "REVIEW"];
  const targetType = allowed.find((candidate) => candidate === type);
  // Reports are stored against UUID keys; anything else cannot be resolved.
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!targetType || !id || !uuid.test(id)) return null;
  return { targetType, targetId: id };
}

async function describeTarget(
  target: { targetType: TargetType; targetId: string },
): Promise<{ label: string; href?: string } | null> {
  if (target.targetType === "PRODUCT") {
    const product = await prisma.product.findUnique({
      where: { id: target.targetId },
      select: { title: true, slug: true },
    });
    return product ? { label: product.title, href: `/product/${product.slug}` } : null;
  }

  if (target.targetType === "USER") {
    const user = await prisma.user.findUnique({
      where: { id: target.targetId },
      select: { username: true, sellerProfile: { select: { slug: true } } },
    });
    if (!user) return null;
    return {
      label: `@${user.username}`,
      href: user.sellerProfile ? `/seller/${user.sellerProfile.slug}` : undefined,
    };
  }

  const review = await prisma.review.findUnique({
    where: { id: target.targetId },
    select: { title: true, body: true, product: { select: { slug: true, title: true } } },
  });
  if (!review) return null;
  return {
    label: review.title ?? `${review.body.slice(0, 60)}… on ${review.product.title}`,
    href: `/product/${review.product.slug}`,
  };
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const { type, id } = await searchParams;
  const target = parseTarget(type, id);
  const targetInfo = target ? await describeTarget(target) : null;

  return (
    <div className="mx-auto max-w-[680px] space-y-5 px-4 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <Flag className="size-4 text-accent" aria-hidden />
          Report content
        </h1>
        <p className="muted mt-1 text-[12.5px] leading-relaxed">
          Reports go to platform staff only. The seller of a reported product is never told who
          filed the report; staff can see the reporter so that a pattern of false reports can be
          identified.
        </p>
      </header>

      {target && !targetInfo ? (
        <Alert tone="warning">
          That content no longer exists, so there is nothing to report. If it has just been removed,
          the report may already have been actioned.
        </Alert>
      ) : null}

      {target && targetInfo ? (
        <Card>
          <CardHeader title="What are you reporting?" />
          <CardBody className="space-y-3">
            <p className="muted text-[13px]">
              {target.targetType === "REVIEW" ? "Review on " : null}
              {targetInfo.href ? (
                <Link href={targetInfo.href} className="text-accent hover:underline">
                  {targetInfo.label}
                </Link>
              ) : (
                targetInfo.label
              )}
            </p>
            <ReportForm
              action={reportContentAction}
              targetType={target.targetType}
              targetId={target.targetId}
            />
          </CardBody>
        </Card>
      ) : null}

      {!target ? (
        <Card>
          <CardHeader
            title="Report from the page you are looking at"
            description="The report form is attached to the content it applies to, so the target is unambiguous."
          />
          <CardBody className="space-y-3">
            <p className="muted text-[12.5px] leading-relaxed">
              Open the product page, the seller profile or the review you want to report and use the
              “Report this …” control on that page. You can also report a listing directly with a
              link of the form{" "}
              <code className="rounded border border-line bg-elevated px-1 py-0.5 text-[11.5px]">
                /report?type=PRODUCT&amp;id=&lt;product-id&gt;
              </code>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/browse" className={buttonClass("secondary", "sm")}>
                Browse products
              </Link>
              <Link href="/support/new" className={buttonClass("secondary", "sm")}>
                <LifeBuoy className="size-3.5" aria-hidden />
                Contact support
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Copyright complaints" />
        <CardBody className="space-y-3">
          <p className="muted text-[12.5px] leading-relaxed">
            A formal copyright notice has to contain more than a report does — identification of
            the work and of the infringing listing, a good-faith statement and your signature.
          </p>
          <Link href="/legal/copyright" className={buttonClass("secondary", "sm")}>
            <Copyright className="size-3.5" aria-hidden />
            Read what a notice must contain
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
