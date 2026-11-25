import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Gamepad2,
  Newspaper,
  ShieldCheck,
  Smartphone,
  Trophy,
} from "lucide-react";

import { StoreBadges } from "@/components/games/store-badges";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { env } from "@/lib/env";
import { buildGameJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import {
  getStudioGameBySlug,
  listStudioGames,
  STUDIO_CONTACT_EMAIL,
} from "@/lib/studios/apps";

export function generateStaticParams() {
  return listStudioGames().map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = getStudioGameBySlug(slug);
  if (!game) return { title: "Game not found" };

  return {
    title: `${game.name} — KDILGAMES`,
    description: game.tagline,
    openGraph: {
      title: game.name,
      description: game.tagline,
    },
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getStudioGameBySlug(slug);
  if (!game) notFound();

  const gameJsonLd = buildGameJsonLd({
    siteUrl: env.siteUrl,
    slug: game.slug,
    name: game.name,
    description: game.description,
    imageUrl: game.bannerPath ?? game.iconPath,
    platform: game.platform,
    genres: game.genres,
    version: game.version,
  });

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(gameJsonLd) }}
      />
      <Link
        href="/games"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All KDILGAMES titles
      </Link>

      <Card className="overflow-hidden">
        {game.bannerPath ? (
          <div className="relative aspect-[2.2/1] w-full overflow-hidden border-b border-line bg-elevated">
            <Image
              src={game.bannerPath}
              alt={`${game.name} feature graphic`}
              width={1280}
              height={580}
              priority
              className="size-full object-cover"
            />
          </div>
        ) : null}

        <CardBody className="space-y-5 p-6">
          <div className="flex flex-wrap items-start gap-4">
            <Image
              src={game.iconPath}
              alt={`${game.name} icon`}
              width={72}
              height={72}
              className="size-16 shrink-0 rounded-2xl border border-line object-cover shadow-xs sm:size-20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">
                  {game.name}
                </h1>
                <Badge tone="accent">{game.statusLabel}</Badge>
                <Badge>v{game.version}</Badge>
              </div>
              <p className="subtle mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="size-3.5" aria-hidden />
                  {game.platform}
                </span>
                <span>·</span>
                <span>{game.category}</span>
                <span>·</span>
                <code className="font-mono text-[11.5px]">{game.packageName}</code>
              </p>
              <p className="muted mt-2.5 text-[14px] leading-relaxed">{game.tagline}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StoreBadges
              appStoreUrl={game.appStoreUrl}
              playStoreUrl={game.playStoreUrl}
              gameName={game.name}
            />
            <Link href={`/studios/${game.slug}`} className={buttonClass("secondary", "sm")}>
              <Trophy className="size-3.5" aria-hidden />
              Studio hub &amp; leaderboard
            </Link>
            <Link href="/press" className={buttonClass("secondary", "sm")}>
              <Newspaper className="size-3.5" aria-hidden />
              Press kit
            </Link>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={`About ${game.name}`} />
            <CardBody className="space-y-4 text-[13.5px] leading-relaxed text-ink-muted">
              <p>{game.description}</p>
              <div className="space-y-2 pt-1">
                <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                  <Gamepad2 className="size-4 text-accent" aria-hidden />
                  Key features
                </h2>
                <ul className="space-y-2">
                  {game.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Game fact sheet" />
            <CardBody>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="subtle">Developer</dt>
                  <dd className="font-medium text-ink">KDILGAMES Software Studios</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="subtle">Version</dt>
                  <dd className="font-mono text-ink">v{game.version}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="subtle">Platform</dt>
                  <dd className="text-ink">{game.platform}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="subtle">Monetization</dt>
                  <dd className="text-right text-ink">{game.monetizationNote}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="subtle">Support</dt>
                  <dd>
                    <a href={`mailto:${STUDIO_CONTACT_EMAIL}`} className="text-accent hover:underline">
                      {STUDIO_CONTACT_EMAIL}
                    </a>
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Data safety & legal" />
            <CardBody className="space-y-3 text-[12.5px]">
              <dl className="space-y-2">
                {game.dataSafety.map((row) => (
                  <div key={row.label}>
                    <dt className="font-medium text-ink">{row.label}</dt>
                    <dd className="subtle">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <Link
                  href={`/studios/${game.slug}/privacy`}
                  className={buttonClass("secondary", "sm")}
                >
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Privacy Policy
                </Link>
                <Link
                  href={`/studios/${game.slug}/terms`}
                  className={buttonClass("secondary", "sm")}
                >
                  <FileText className="size-3.5" aria-hidden />
                  Terms of Service
                </Link>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
