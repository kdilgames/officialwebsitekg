import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { CookiePreferencesButton } from "@/components/layout/cookie-banner";
import { env } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server";
import { getCommunityDiscordUrl } from "@/lib/queries/products";

export async function SiteFooter() {
  const [discordUrl, locale] = await Promise.all([getCommunityDiscordUrl(), getServerLocale()]);
  const dict = getDictionary(locale);

  const columns = [
    {
      id: "marketplace",
      title: dict.footer.marketplace,
      links: [
        { href: "/browse", label: "All products" },
        { href: "/browse?price=free", label: "Free resources" },
        { href: "/browse?sort=best-selling", label: "Best selling" },
        { href: "/sellers", label: "Verified sellers" },
      ],
    },
    {
      id: "creators",
      title: dict.footer.creators,
      links: [
        { href: "/account/seller", label: "Become a seller" },
        { href: "/dashboard", label: "Seller dashboard" },
        { href: "/legal/seller-agreement", label: "Seller agreement" },
        { href: "/legal/fees", label: "Fees & commissions" },
      ],
    },
    {
      id: "support",
      title: dict.footer.support,
      links: [
        { href: "/support", label: "Help centre" },
        { href: "/support#verification", label: "File safety & review" },
        { href: "/support/new", label: "Contact support" },
        { href: "/report", label: "Report a listing" },
      ],
    },
    {
      id: "studios",
      title: dict.footer.studios,
      links: [
        { href: "/games", label: dict.ourGames.heading },
        { href: "/games/byterack-tycoon", label: "ByteRack Tycoon" },
        { href: "/press", label: dict.ourGames.pressKit },
        { href: "/blog", label: dict.nav.blog },
        { href: "/studios", label: "All Apps & Studios" },
        { href: "/studios/privacy", label: "Studios Privacy Policy" },
      ],
    },
    {
      id: "legal",
      title: dict.footer.legal,
      links: [
        { href: "/legal/terms", label: "Terms of Service" },
        { href: "/legal/privacy", label: "Marketplace Privacy Policy" },
        { href: "/legal/refunds", label: "Refund Policy" },
        { href: "/legal/cookies", label: "Cookie Policy" },
        { href: "/dmca", label: "DMCA & Copyright" },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]">
          <div>
            <Link href="/" className="inline-block rounded-[9px] py-0.5 pr-1">
              <BrandMark />
            </Link>
            <p className="muted mt-3 max-w-xs text-[13px] leading-relaxed">{dict.footer.tagline}</p>
            <p className="subtle mt-3 text-[12px]">{dict.footer.operatedIn}</p>
            {discordUrl ? (
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline"
              >
                Join Discord community
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>

          {columns.map((column) => (
            <div key={column.id}>
              <p className="subtle text-[11px] font-semibold uppercase tracking-[0.06em]">
                {column.title}
              </p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                {column.id === "legal" ? (
                  <li>
                    <CookiePreferencesButton />
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider my-8" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="subtle text-[12px]">
            © {new Date().getFullYear()} {env.marketplace.platformName}. {dict.footer.rightsReserved}
          </p>
          <p className="subtle max-w-xl text-[12px] leading-relaxed">
            Payments and payouts are processed securely by Stripe. Card details never pass through{" "}
            {env.marketplace.platformName} servers.
          </p>
        </div>
      </div>
    </footer>
  );
}
