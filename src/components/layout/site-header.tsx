import Link from "next/link";

import {
  Bell,
  Gamepad2,
  Heart,
  LayoutDashboard,
  LogIn,
  Search,
  Shield,
  ShoppingCart,
  Store,
  UserRound,
  Users,
} from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getSessionUser, isAdmin, isOwner, isSeller } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server";

export async function SiteHeader() {
  const [user, locale] = await Promise.all([getSessionUser(), getServerLocale()]);
  const dict = getDictionary(locale);

  const navLinks = [
    { href: "/browse", label: dict.nav.browse },
    { href: "/browse?sort=best-selling", label: dict.nav.bestSelling },
    { href: "/sellers", label: dict.nav.sellers },
    { href: "/games", label: dict.nav.games },
    { href: "/blog", label: dict.nav.blog },
    { href: "/support", label: dict.nav.help },
  ];

  const [itemCount, bundleCount, recentNotifications, unreadNotifications] = user
    ? await Promise.all([
        prisma.cartItem.count({ where: { cart: { userId: user.id } } }),
        withSchemaFallback(() => prisma.cartBundle.count({ where: { cart: { userId: user.id } } }), 0),
        prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true },
        }),
        prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      ])
    : [0, 0, [], 0];
  const cartCount = itemCount + bundleCount;
  const userIsAdmin = isAdmin(user);
  const userIsOwner = isOwner(user);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-[9px] py-0.5 pr-1"
          aria-label="KDILGAMES Home"
        >
          <BrandMark />
        </Link>

        <nav className="ml-1 hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn btn-ghost btn-sm text-ink-muted hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          <span className="mx-1.5 h-4 w-px bg-line" aria-hidden />
          <Link
            href="/studios"
            className="btn btn-ghost btn-sm text-accent hover:bg-accent-quiet/60 hover:text-accent-ink"
          >
            <Gamepad2 className="size-3.5" aria-hidden />
            {dict.nav.studios}
          </Link>
        </nav>

        <form action="/browse" className="relative ml-auto hidden w-full max-w-xs sm:block lg:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            placeholder={dict.nav.searchPlaceholder}
            aria-label="Search the marketplace"
            className="input h-9 bg-elevated/70 pl-9 focus:bg-surface"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 sm:ml-0 sm:gap-1.5">
          <LanguageSwitcher currentLocale={locale} />
          <ThemeToggle />

          {userIsAdmin ? (
            <Link
              href="/admin"
              className="btn btn-secondary btn-sm hidden px-2.5 sm:inline-flex"
              title="Open Administration Panel"
            >
              <Shield className="size-3.5 text-accent" aria-hidden />
              <span>Admin</span>
            </Link>
          ) : null}

          {user ? (
            <>
              <Link
                href="/account/wishlist"
                className="btn btn-ghost btn-sm px-2"
                aria-label="Wishlist"
                title="Wishlist"
              >
                <Heart className="size-4" aria-hidden />
              </Link>
              <NotificationsBell
                notifications={recentNotifications}
                unreadCount={unreadNotifications}
              />
            </>
          ) : null}

          <Link
            href="/cart"
            className="btn btn-ghost btn-sm relative px-2 sm:px-2.5"
            aria-label={`${dict.nav.cart}${cartCount > 0 ? `, ${cartCount} items` : ""}`}
          >
            <ShoppingCart className="size-4" aria-hidden />
            <span className="hidden xl:inline">{dict.nav.cart}</span>
            {cartCount > 0 ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-accent-fill text-[10px] font-semibold text-white">
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
                  className="size-5"
                  textClassName="text-[10px]"
                />
                <span className="hidden max-w-[120px] truncate sm:inline">{user.displayName}</span>
              </summary>
              <div className="surface absolute right-0 z-50 mt-2 w-64 overflow-hidden p-1.5 shadow-lg">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <Avatar
                    url={user.avatarUrl}
                    fallback={user.displayName.slice(0, 1).toUpperCase()}
                    className="size-8"
                    textClassName="text-[12px]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{user.displayName}</p>
                    <p className="subtle truncate text-[11.5px]">
                      @{user.username}
                      {userIsOwner && userIsAdmin
                        ? " · owner"
                        : userIsAdmin
                          ? " · admin"
                          : isSeller(user)
                            ? " · seller"
                            : ""}
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
                <MenuLink href="/account/wishlist" icon={<Heart className="size-3.5" />}>
                  Wishlist
                </MenuLink>
                <MenuLink href="/account/following" icon={<Users className="size-3.5" />}>
                  Following stores
                </MenuLink>
                <MenuLink href="/account/notifications" icon={<Bell className="size-3.5" />}>
                  Notifications
                  {unreadNotifications > 0 ? (
                    <span className="ml-auto rounded-full bg-accent-quiet px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">
                      {unreadNotifications}
                    </span>
                  ) : null}
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
                {userIsAdmin ? (
                  <>
                    <MenuLink href="/admin" icon={<Shield className="size-3.5" />}>
                      Administration
                    </MenuLink>
                    <MenuLink href="/admin/access" icon={<Shield className="size-3.5" />}>
                      Access &amp; Emails
                    </MenuLink>
                  </>
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
              <Link href="/login" className="btn btn-ghost btn-sm px-2 sm:px-3">
                <LogIn className="size-3.5" aria-hidden />
                <span className="max-[420px]:hidden">Sign in</span>
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm px-2.5 sm:px-3">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-canvas/70 lg:hidden">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2 sm:px-6">
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="btn btn-ghost btn-sm shrink-0 text-ink-muted"
              >
                {link.label}
              </Link>
            ))}
            <span className="mx-0.5 h-3.5 w-px shrink-0 bg-line" aria-hidden />
            <Link
              href="/studios"
              className="btn btn-ghost btn-sm shrink-0 text-accent"
            >
              <Gamepad2 className="size-3.5" aria-hidden />
              Software Studios
            </Link>
          </nav>
          <form action="/browse" className="relative w-40 shrink-0 sm:hidden">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              placeholder="Search..."
              aria-label="Search the marketplace"
              className="input h-8 pl-8 text-[12.5px]"
            />
          </form>
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
      className={`${className} ${textClassName} flex shrink-0 items-center justify-center rounded-full bg-elevated font-semibold text-ink-muted`}
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
      className="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
    >
      {icon}
      {children}
    </Link>
  );
}
