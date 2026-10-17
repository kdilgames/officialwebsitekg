import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "accent" | "positive" | "caution" | "critical";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={cn("badge", tone !== "neutral" && `badge-${tone}`, className)}>{children}</span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  PUBLISHED: "positive",
  APPROVED: "positive",
  PAID: "positive",
  SUCCEEDED: "positive",
  ACTIVE: "positive",
  CLEAN: "positive",
  RESOLVED: "positive",
  WON: "positive",
  AVAILABLE: "positive",
  PROCESSED: "positive",

  DRAFT: "neutral",
  PENDING: "caution",
  PENDING_REVIEW: "caution",
  REQUIRES_PAYMENT: "caution",
  PROCESSING: "caution",
  REQUESTED: "caution",
  UNDER_REVIEW: "caution",
  IN_TRANSIT: "caution",
  NEEDS_RESPONSE: "caution",
  OPEN: "caution",
  PARTIALLY_REFUNDED: "caution",

  REJECTED: "critical",
  SUSPENDED: "critical",
  FAILED: "critical",
  INFECTED: "critical",
  LOST: "critical",
  CANCELED: "critical",
  DISPUTED: "critical",
  URGENT: "critical",

  ARCHIVED: "neutral",
  CLOSED: "neutral",
  IGNORED: "neutral",
  SKIPPED: "neutral",
  DISMISSED: "neutral",
  HIDDEN: "neutral",
  REMOVED: "critical",
  REFUNDED: "neutral",
  REVERSED: "critical",
};

/** Renders a database enum/status with a consistent colour. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? "neutral";
  return (
    <Badge tone={tone} className={className}>
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
