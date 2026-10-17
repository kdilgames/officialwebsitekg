import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type AlertTone = "info" | "success" | "warning" | "error";

const TONES: Record<AlertTone, string> = {
  info: "border-accent/35 bg-accent-quiet/60 text-[#9dc0fb]",
  success: "border-positive/30 bg-positive/8 text-[#6ee7b7]",
  warning: "border-caution/30 bg-caution/8 text-[#fbbf24]",
  error: "border-critical/30 bg-critical/8 text-[#fca5a5]",
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
    <div className={cn("rounded-[8px] border px-3.5 py-2.5 text-[12.5px]", TONES[tone], className)}>
      {title ? <p className="font-medium">{title}</p> : null}
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
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-ink-subtle">{icon}</div> : null}
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      {description ? <p className="muted max-w-md text-[12.5px]">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
