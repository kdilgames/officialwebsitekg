import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Download, ExternalLink, Mail, Newspaper } from "lucide-react";

import { StoreBadges } from "@/components/games/store-badges";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  listStudioGames,
  STUDIO_CONTACT_EMAIL,
  STUDIO_SOCIAL_LINKS,
} from "@/lib/studios/apps";

export const metadata: Metadata = {
  title: "Press Kit",
  description:
    "Official KDILGAMES press kit — studio fact sheet, brand logos, game key art, and media contact details.",
};

const BRAND_ASSETS = [
  {
    name: "KDILGAMES Software Studios Logo",
    file: "/images/studios/kdil-studios-logo.png",
    description: "Official studio emblem (PNG, transparent / dark ready).",
  },
  {
    name: "ByteRack Tycoon — App Icon",
    file: "/images/studios/byterack-tycoon-icon.png",
    description: "High-resolution square store icon (PNG).",
  },
  {
    name: "ByteRack Tycoon — Feature Graphic",
    file: "/images/studios/byterack-tycoon-banner.png",
    description: "Landscape promotional banner for articles & videos (PNG).",
  },
];

export default function PressKitPage() {
  const games = listStudioGames();

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="max-w-2xl">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-accent">
            Media &amp; Press
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-[26px] font-bold tracking-tight text-ink">
            <Newspaper className="size-6 text-accent" aria-hidden />
            KDILGAMES Press Kit
          </h1>
          <p className="muted mt-2 text-[14px] leading-relaxed">
            Logos, game key art, studio background, and approved descriptions for journalists,
            content creators, and partners covering KDILGAMES and our titles.
          </p>
        </div>
        <a
          href={`mailto:${STUDIO_CONTACT_EMAIL}?subject=KDILGAMES%20Press%20Inquiry`}
          className={buttonClass("primary", "sm")}
        >
          <Mail className="size-3.5" aria-hidden />
          Press inquiry
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader title="Studio fact sheet" />
          <CardBody>
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="subtle text-[11px] font-semibold uppercase">Studio &amp; Platform</dt>
                <dd className="mt-0.5 font-medium text-ink">KDILGAMES / KDILGAMES Software Studios</dd>
              </div>
              <div>
                <dt className="subtle text-[11px] font-semibold uppercase">Location</dt>
                <dd className="mt-0.5 text-ink">Croatia (European Union)</dd>
              </div>
              <div>
                <dt className="subtle text-[11px] font-semibold uppercase">Focus</dt>
                <dd className="mt-0.5 text-ink">
                  Independent mobile games + curated digital marketplace for game developers &amp;
                  server owners
                </dd>
              </div>
              <div>
                <dt className="subtle text-[11px] font-semibold uppercase">Press &amp; Creator Contact</dt>
                <dd className="mt-0.5">
                  <a href={`mailto:${STUDIO_CONTACT_EMAIL}`} className="text-accent hover:underline">
                    {STUDIO_CONTACT_EMAIL}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="subtle text-[11px] font-semibold uppercase">Official Channels</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {STUDIO_SOCIAL_LINKS.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="badge hover:border-line-strong hover:text-ink"
                    >
                      {item.label}
                      <ExternalLink className="size-2.5" aria-hidden />
                    </a>
                  ))}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Boilerplate & description" />
          <CardBody className="space-y-4 text-[13.5px] leading-relaxed text-ink-muted">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink">
                Short bio
              </h2>
              <p className="mt-1">
                KDILGAMES is an independent Croatian game studio and digital developer marketplace
                building offline-first mobile strategy games and curated tools for Roblox,
                Minecraft, Discord, and web creators.
              </p>
            </div>
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink">
                About KDILGAMES Software Studios
              </h2>
              <p className="mt-1">
                Operating out of Croatia (EU), KDILGAMES Software Studios focuses on deep,
                player-respecting simulation and tycoon games without intrusive third-party ad
                trackers. Alongside its in-house titles, KDILGAMES runs a curated creator
                marketplace with verified file review, instant Stripe payouts, software licensing,
                and transparent EU VAT handling.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">Brand &amp; game assets</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {BRAND_ASSETS.map((asset) => (
            <Card key={asset.file} className="overflow-hidden">
              <div className="flex aspect-[16/10] items-center justify-center border-b border-line bg-elevated p-4">
                <Image
                  src={asset.file}
                  alt={asset.name}
                  width={480}
                  height={280}
                  className="max-h-full w-auto rounded-lg object-contain"
                />
              </div>
              <CardBody className="space-y-2 p-4">
                <p className="text-[13.5px] font-semibold text-ink">{asset.name}</p>
                <p className="subtle text-[12px]">{asset.description}</p>
                <a href={asset.file} download className={buttonClass("secondary", "sm")}>
                  <Download className="size-3.5" aria-hidden />
                  Download PNG
                </a>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">Published games</h2>
        <div className="grid gap-4">
          {games.map((game) => (
            <Card key={game.slug}>
              <CardBody className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="max-w-2xl space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/games/${game.slug}`}
                      className="text-[16px] font-semibold text-ink hover:text-accent"
                    >
                      {game.name}
                    </Link>
                    <Badge tone="accent">{game.statusLabel}</Badge>
                    <Badge>v{game.version}</Badge>
                  </div>
                  <p className="muted text-[13px] leading-relaxed">{game.description}</p>
                  <StoreBadges
                    appStoreUrl={game.appStoreUrl}
                    playStoreUrl={game.playStoreUrl}
                    gameName={game.name}
                  />
                </div>
                <Link href={`/games/${game.slug}`} className={buttonClass("secondary", "sm")}>
                  Game page
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
