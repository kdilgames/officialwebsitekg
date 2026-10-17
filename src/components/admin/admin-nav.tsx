"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  /** Key into the queue counts supplied by the server layout. */
  count?: string;
  exact?: boolean;
};

const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Catalogue",
    items: [
      { href: "/admin", label: "Overview", exact: true },
      { href: "/admin/sellers", label: "Sellers", count: "sellerApplications" },
      { href: "/admin/products", label: "Products", count: "productReviews" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/commissions", label: "Commissions" },
      { href: "/admin/reviews", label: "Reviews" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/refunds", label: "Refunds", count: "refunds" },
      { href: "/admin/disputes", label: "Disputes", count: "disputes" },
      { href: "/admin/payouts", label: "Payouts", count: "payouts" },
    ],
  },
  {
    title: "Trust",
    items: [
      { href: "/admin/reports", label: "Reports", count: "reports" },
      { href: "/admin/tickets", label: "Support", count: "tickets" },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/audit", label: "Audit log" },
    ],
  },
];

export function AdminNav({
  counts,
  orientation = "vertical",
}: {
  counts: Record<string, number>;
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();

  if (orientation === "horizontal") {
    return (
      <nav aria-label="Administration" className="flex gap-1 overflow-x-auto">
        {SECTIONS.flatMap((section) => section.items).map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} counts={counts} />
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Administration" className="space-y-4">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-subtle">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} counts={counts} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  counts,
}: {
  item: NavItem;
  pathname: string;
  counts: Record<string, number>;
}) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const count = item.count ? (counts[item.count] ?? 0) : 0;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] transition-colors",
        active ? "bg-elevated text-ink" : "text-ink-muted hover:bg-elevated hover:text-ink",
      )}
    >
      <span>{item.label}</span>
      {count > 0 ? (
        <span className="rounded-full bg-accent-quiet px-1.5 text-[11px] font-medium tabular-nums text-accent">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
