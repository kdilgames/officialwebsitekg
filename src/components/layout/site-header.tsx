import Link from "next/link";

import {
  Boxes,
  LayoutDashboard,
  LogIn,
  Search,
  Shield,
  ShoppingCart,
  Store,
  UserRound,
} from "lucide-react";

import { getSessionUser, isAdmin, isSeller } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const NAV_LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/browse?sort=newest", label: "Newest" },
  { href: "/browse?sort=best-selling", label: "Best selling" },
  { href: "/sellers", label: "Sellers" },
];

export async function SiteHeader() {
  const user = await getSessionUser();

  const cartCount = user
    ? await prisma.cartItem.count({ where: { cart: { userId: user.id } } })
    : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-elevated">
            <Boxes className="size-4 text-accent" aria-hidden />
          </span>
          <span className="text-[14px] font-semibold tracking-tight">
            {env.marketplace.platformName}
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn btn-ghost btn-sm text-ink-muted hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <form action="/browse" className="relative ml-auto hidden w-full max-w-sm sm:block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            placeholder="Search products, categories, sellers"
            aria-label="Search the marketplace"
            className="input h-8 pl-8"
          />
        </form>

        <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
          <Link
            href="/cart"
            className="btn btn-ghost btn-sm relative"
            aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
          >
            <ShoppingCart className="size-4" aria-hidden />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            ) : null}
          </Link>

          {user ? (
            <details className="group relative">
              <summary className="btn btn-secondary btn-sm list-none [&::-webkit-details-marker]:hidden">
                <Avatar
                  url={user.avatarUrl}
                  fallback={user.displayName.slice(0, 1).toUpperCase()}
                  className="size-4"
                  textClassName="text-[9px]"
                />
                <span className="hidden max-w-[120px] truncate sm:inline">{user.displayName}</span>
              </summary>
              <div className="surface-elevated absolute right-0 z-50 mt-1.5 w-60 overflow-hidden p-1 shadow-lg">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <Avatar
                    url={user.avatarUrl}
                    fallback={user.displayName.slice(0, 1).toUpperCase()}
                    className="size-8"
                    textClassName="text-[12px]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] text-ink">{user.displayName}</p>
                    <p className="subtle truncate text-[11.5px]">
                      @{user.username}
                      {user.role === "ADMIN" ? " · admin" : isSeller(user) ? " · seller" : ""}
                    </p>
                  </div>
                </div>
                <div className="divider my-1" />
                <MenuLink href="/account" icon={<UserRound className="size-3.5" />}>
                  Account
                </MenuLink>
                <MenuLink href="/account/orders" icon={<ShoppingCart className="size-3.5" />}>
                  Orders &amp; downloads
                </MenuLink>
                <MenuLink href="/account/wishlist" icon={<Store className="size-3.5" />}>
                  Wishlist
                </MenuLink>
                {isSeller(user) ? (
                  <MenuLink href="/dashboard" icon={<LayoutDashboard className="size-3.5" />}>
                    Seller dashboard
                  </MenuLink>
                ) : (
                  <MenuLink href="/account/seller" icon={<Store className="size-3.5" />}>
                    Become a seller
                  </MenuLink>
                )}
                {isAdmin(user) ? (
                  <MenuLink href="/admin" icon={<Shield className="size-3.5" />}>
                    Administration
                  </MenuLink>
                ) : null}
                <div className="divider my-1" />
                <form action={signOutAction}>
                  <button type="submit" className="btn btn-ghost btn-sm w-full justify-start">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                <LogIn className="size-3.5" aria-hidden />
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-line md:hidden">
        <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn btn-ghost btn-sm shrink-0 text-ink-muted"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

function Avatar({
  url,
  fallback,
  className,
  textClassName,
}: {
  url: string | null;
  fallback: string;
  className: string;
  textClassName: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts
      <img src={url} alt="" className={`${className} shrink-0 rounded-full object-cover`} />
    );
  }

  return (
    <span
      className={`${className} ${textClassName} flex shrink-0 items-center justify-center rounded-full bg-raised font-semibold text-ink-muted`}
    >
      {fallback}
    </span>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
    >
      {icon}
      {children}
    </Link>
  );
}
