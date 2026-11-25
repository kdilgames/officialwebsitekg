import Link from "next/link";
import { Compass, Home, LifeBuoy, Search } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { env } from "@/lib/env";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="rounded-[9px] py-0.5 pr-1" aria-label="KDILGAMES Home">
            <BrandMark />
          </Link>

          <nav className="flex items-center gap-1.5" aria-label="Recovery navigation">
            <Link href="/browse" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              Browse
            </Link>
            <Link href="/sellers" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              Sellers
            </Link>
            <Link href="/support" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              Help
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="surface w-full p-6 shadow-sm sm:p-8">
          <span className="inline-flex items-center rounded-full border border-line bg-elevated px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-accent">
            404 · PAGE NOT FOUND
          </span>

          <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-ink">
            We couldn&apos;t find that listing or page
          </h1>
          <p className="muted mt-2 text-[13.5px] leading-relaxed">
            The link may be mistyped, or the listing may have been archived or removed by its creator.
          </p>

          <form action="/browse" className="relative mt-5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              placeholder="Search plugins, scripts, bots, templates..."
              aria-label="Search the marketplace"
              className="input h-10 bg-canvas pl-9 pr-24"
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm absolute right-1.5 top-1/2 -translate-y-1/2"
            >
              Search
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className="btn btn-secondary btn-sm">
              <Home className="size-3.5" aria-hidden />
              Back home
            </Link>
            <Link href="/browse" className="btn btn-primary btn-sm">
              <Compass className="size-3.5" aria-hidden />
              Browse marketplace
            </Link>
            <Link href="/support" className="btn btn-ghost btn-sm">
              <LifeBuoy className="size-3.5" aria-hidden />
              Help centre
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-line bg-surface py-5">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 text-[12px] text-ink-subtle sm:px-6">
          <span>
            © {new Date().getFullYear()} {env.marketplace.platformName}. All rights reserved.
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/browse" className="hover:text-ink">
              Catalogue
            </Link>
            <Link href="/legal/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/support" className="hover:text-ink">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
