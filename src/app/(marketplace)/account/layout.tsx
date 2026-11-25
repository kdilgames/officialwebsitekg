import Link from "next/link";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders & downloads" },
  { href: "/account/messages", label: "Messages" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/following", label: "Following" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/affiliate", label: "Affiliate" },
  { href: "/account/security", label: "Security & 2FA" },
  { href: "/account/privacy", label: "Privacy & GDPR" },
  { href: "/account/seller", label: "Selling" },
  { href: "/support", label: "Support" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <nav className="mb-5 flex flex-wrap items-center gap-1 border-b border-line pb-2">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="btn btn-ghost btn-sm text-ink-muted">
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
