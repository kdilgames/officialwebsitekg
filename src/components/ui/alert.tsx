import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type AlertTone = "info" | "success" | "warning" | "error";

const TONES: Record<AlertTone, string> = {
  info: "border-accent/25 bg-accent-quiet text-accent-ink",
  success: "border-positive/25 bg-positive-quiet text-positive-ink",
  warning: "border-caution/30 bg-caution-quiet text-caution-ink",
  error: "border-critical/25 bg-critical-quiet text-critical-ink",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[10px] border px-4 py-3 text-[13px]", TONES[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1", "leading-relaxed")}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
      {icon ? (
        <div className="mb-1 flex size-11 items-center justify-center rounded-full border border-line bg-elevated text-ink-muted">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description ? <p className="muted max-w-md text-[13px] leading-relaxed">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
