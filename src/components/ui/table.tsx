import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("surface overflow-x-auto", className)}>
      <table className="table">{children}</table>
    </div>
  );
}

/**
 * Renders a bounded page window with first/last controls. The window size is
 * fixed so the layout never shifts as the result set grows.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const window = 2;
  const start = Math.max(1, page - window);
  const end = Math.min(totalPages, page + window);
  const pages: number[] = [];
  for (let current = start; current <= end; current += 1) pages.push(current);

  return (
    <nav className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Pagination">
      <PageLink href={buildHref(Math.max(1, page - 1))} disabled={page <= 1}>
        Previous
      </PageLink>

      {start > 1 ? (
        <>
          <PageLink href={buildHref(1)}>1</PageLink>
          {start > 2 ? <span className="subtle px-1 text-[12px]">…</span> : null}
        </>
      ) : null}

      {pages.map((value) => (
        <PageLink key={value} href={buildHref(value)} active={value === page}>
          {value}
        </PageLink>
      ))}

      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? <span className="subtle px-1 text-[12px]">…</span> : null}
          <PageLink href={buildHref(totalPages)}>{totalPages}</PageLink>
        </>
      ) : null}

      <PageLink href={buildHref(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        Next
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="btn btn-secondary btn-sm pointer-events-none opacity-40">{children}</span>
    );
  }

  return (
    <Link
      href={href}
      className={cn("btn btn-sm", active ? "btn-primary" : "btn-secondary")}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
