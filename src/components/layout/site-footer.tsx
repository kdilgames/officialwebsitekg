import Link from "next/link";

import { env } from "@/lib/env";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { href: "/browse", label: "All products" },
      { href: "/browse?sort=newest", label: "Newest" },
      { href: "/browse?sort=best-selling", label: "Best selling" },
      { href: "/sellers", label: "Sellers" },
    ],
  },
  {
    title: "Sell",
    links: [
      { href: "/account/seller", label: "Become a seller" },
      { href: "/dashboard", label: "Seller dashboard" },
      { href: "/legal/seller-agreement", label: "Seller agreement" },
      { href: "/legal/fees", label: "Fees & commissions" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/support", label: "Help centre" },
      { href: "/support/new", label: "Contact support" },
      { href: "/report", label: "Report a product" },
      { href: "/legal/copyright", label: "Copyright complaints" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/refunds", label: "Refund Policy" },
      { href: "/legal/cookies", label: "Cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <div>
            <p className="text-[14px] font-semibold tracking-tight">
              {env.marketplace.platformName}
            </p>
            <p className="muted mt-2 max-w-xs text-[12.5px] leading-relaxed">
              A marketplace for digital products built for game developers: Roblox systems,
              Minecraft plugins, Discord bots, web templates and developer tooling.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="subtle text-[11px] font-medium uppercase tracking-[0.06em]">
                {column.title}
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[12.5px] text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider my-7" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="subtle text-[12px]">
            © {new Date().getFullYear()} {env.marketplace.platformName}. All rights reserved.
          </p>
          <p className="subtle max-w-xl text-[12px] leading-relaxed">
            Payments are processed by our payment provider. The platform is operated from Croatia
            (EU); tax, consumer-protection and record-keeping obligations require review by a
            qualified professional.
          </p>
        </div>
      </div>
    </footer>
  );
}
