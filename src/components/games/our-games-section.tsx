import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gamepad2, Newspaper, Smartphone } from "lucide-react";

import { StoreBadges } from "@/components/games/store-badges";
import { Badge } from "@/components/ui/badge";
import { listStudioGames } from "@/lib/studios/apps";

export function OurGamesSection() {
  const games = listStudioGames();
  if (games.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="our-games-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-accent">
            Original Titles
          </p>
          <h2
            id="our-games-heading"
            className="mt-0.5 flex items-center gap-2 text-[20px] font-semibold tracking-tight text-ink"
          >
            <Gamepad2 className="size-5 text-accent" aria-hidden />
            Our Games
          </h2>
          <p className="muted mt-0.5 text-[13px]">
            Games developed in-house by KDILGAMES Software Studios — built offline-first with zero
            forced ads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/press" className="btn btn-secondary btn-sm">
            <Newspaper className="size-3.5" aria-hidden />
            Press kit
          </Link>
          <Link href="/games" className="btn btn-ghost btn-sm text-ink-muted hover:text-ink">
            All games
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {games.map((game) => (
          <article
            key={game.slug}
            className="surface card-interactive flex flex-col justify-between overflow-hidden"
          >
            <div>
              {game.bannerPath ? (
                <Link
                  href={`/games/${game.slug}`}
                  className="relative block aspect-[2.1/1] overflow-hidden border-b border-line bg-elevated"
                >
                  <Image
                    src={game.bannerPath}
                    alt={`${game.name} key art`}
                    width={1024}
                    height={500}
                    className="size-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  />
                </Link>
              ) : null}

              <div className="p-5">
                <div className="flex items-start gap-3.5">
                  <Image
                    src={game.iconPath}
                    alt={`${game.name} icon`}
                    width={56}
                    height={56}
                    className="size-14 shrink-0 rounded-xl border border-line object-cover shadow-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/games/${game.slug}`}
                        className="text-[17px] font-semibold tracking-tight text-ink hover:text-accent"
                      >
                        {game.name}
                      </Link>
                      <Badge tone="accent">{game.statusLabel}</Badge>
                      <Badge>v{game.version}</Badge>
                    </div>
                    <p className="subtle mt-0.5 flex items-center gap-1.5 text-[12px]">
                      <Smartphone className="size-3.5" aria-hidden />
                      {game.platform} · {game.category}
                    </p>
                  </div>
                </div>

                <p className="muted mt-3 text-[13.5px] leading-relaxed">{game.tagline}</p>

                <div className="mt-4">
                  <StoreBadges
                    appStoreUrl={game.appStoreUrl}
                    playStoreUrl={game.playStoreUrl}
                    gameName={game.name}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-elevated/50 px-5 py-3">
              <span className="subtle text-[11.5px]">{game.monetizationNote}</span>
              <Link
                href={`/games/${game.slug}`}
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline"
              >
                Explore game
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
