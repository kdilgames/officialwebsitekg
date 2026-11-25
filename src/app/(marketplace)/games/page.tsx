import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gamepad2, Newspaper, ShieldCheck, Smartphone } from "lucide-react";

import { StoreBadges } from "@/components/games/store-badges";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { listStudioGames } from "@/lib/studios/apps";

export const metadata: Metadata = {
  title: "Our Games",
  description:
    "Original mobile and indie games built in-house by KDILGAMES Software Studios — offline-first, no forced ads.",
};

export default function GamesIndexPage() {
  const games = listStudioGames();

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="max-w-2xl">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-accent">
            KDILGAMES Software Studios
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-[26px] font-bold tracking-tight text-ink">
            <Gamepad2 className="size-6 text-accent" aria-hidden />
            Our Games
          </h1>
          <p className="muted mt-2 text-[14px] leading-relaxed">
            Every game we ship under KDILGAMES Software Studios is built with player-first design,
            offline support, transparent privacy disclosures, and zero forced interstitial ads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/press" className={buttonClass("secondary", "sm")}>
            <Newspaper className="size-3.5" aria-hidden />
            Press kit
          </Link>
          <Link href="/studios/privacy" className={buttonClass("ghost", "sm")}>
            <ShieldCheck className="size-3.5" aria-hidden />
            Privacy policy
          </Link>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {games.map((game) => (
          <article key={game.slug} className="surface flex flex-col overflow-hidden">
            {game.bannerPath ? (
              <Link href={`/games/${game.slug}`} className="block aspect-[2/1] overflow-hidden border-b border-line bg-elevated">
                <Image
                  src={game.bannerPath}
                  alt={`${game.name} banner`}
                  width={1024}
                  height={500}
                  className="size-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                />
              </Link>
            ) : null}
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start gap-3.5">
                <Image
                  src={game.iconPath}
                  alt={`${game.name} icon`}
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-xl border border-line object-cover"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/games/${game.slug}`}
                      className="text-[18px] font-semibold text-ink hover:text-accent"
                    >
                      {game.name}
                    </Link>
                    <Badge tone="accent">{game.statusLabel}</Badge>
                  </div>
                  <p className="subtle mt-0.5 flex items-center gap-1.5 text-[12px]">
                    <Smartphone className="size-3.5" aria-hidden />
                    {game.platform} · v{game.version}
                  </p>
                </div>
              </div>

              <p className="muted mt-3 text-[13.5px] leading-relaxed">{game.description}</p>

              <div className="mt-4">
                <StoreBadges
                  appStoreUrl={game.appStoreUrl}
                  playStoreUrl={game.playStoreUrl}
                  gameName={game.name}
                />
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {(game.genres ?? []).map((genre) => (
                    <Badge key={genre}>{genre}</Badge>
                  ))}
                </div>
                <Link
                  href={`/games/${game.slug}`}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline"
                >
                  Game details
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
