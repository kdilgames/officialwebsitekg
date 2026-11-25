"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

import { formatFlashCountdown } from "@/lib/marketplace/flash-sale";

export function FlashSaleBadge({
  saleEndsAt,
  compact = false,
}: {
  saleEndsAt: string;
  compact?: boolean;
}) {
  const [label, setLabel] = useState<string | null>(() => formatFlashCountdown(saleEndsAt));

  useEffect(() => {
    const tick = () => setLabel(formatFlashCountdown(saleEndsAt));
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [saleEndsAt]);

  if (!label) return null;

  return (
    <span
      className="badge badge-caution inline-flex items-center gap-1 font-medium tabular-nums"
      title={`Flash sale ends ${new Date(saleEndsAt).toUTCString()}`}
    >
      <Zap className="size-3 fill-current" aria-hidden />
      {compact ? label : `Flash sale · ${label}`}
    </span>
  );
}
