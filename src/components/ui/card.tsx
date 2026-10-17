import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag className={cn("surface", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {description ? <p className="muted mt-0.5 text-[12px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

/**
 * Compact statistics tile used across the seller and admin dashboards.
 * Every value is passed in from a real database aggregate — never hard-coded.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "neutral" | "positive" | "caution" | "accent";
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "caution"
        ? "text-caution"
        : tone === "accent"
          ? "text-accent"
          : "text-ink";

  return (
    <div className="surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="subtle text-[11px] font-medium uppercase tracking-[0.04em]">{label}</span>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <div className={cn("mt-2 text-[20px] font-semibold tabular-nums tracking-tight", toneClass)}>
        {value}
      </div>
      {hint ? <p className="subtle mt-1 text-[11.5px]">{hint}</p> : null}
    </div>
  );
}
