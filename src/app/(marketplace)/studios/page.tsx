import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Gamepad2,
  Layers,
  ShieldCheck,
} from "lucide-react";

import { StudiosSidebar } from "@/components/studios/studios-sidebar";
import { listStudioApps } from "@/lib/studios/apps";

export const metadata: Metadata = {
  title: "KDILGAMES Software Studios — Apps & Games",
  description:
    "Explore mobile games and software applications built in-house by KDILGAMES Software Studios, including ByteRack Tycoon and per-app privacy policies.",
};

export default function StudiosHubPage() {
  const apps = listStudioApps();

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <StudiosSidebar activePath="/studios" />

        <div className="space-y-8">
          <header className="surface p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-accent">KDILGAMES Software Studios</span>
              <span className="badge">Apps &amp; Mobile Games</span>
            </div>

            <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-[-0.025em] text-ink sm:text-[34px]">
              First-party mobile games &amp; apps built by KDILGAMES
            </h1>
            <p className="muted mt-3 max-w-2xl text-[14.5px] leading-relaxed">
              This dedicated section houses original software and games created directly by
              KDILGAMES Software Studios — separate from third-party creator listings on the
              marketplace. Each title includes full specifications and a standalone Google Play
              Privacy Policy.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href="/studios/privacy" className="btn btn-secondary">
                <ShieldCheck className="size-4 text-accent" aria-hidden />
                Studios General Privacy Policy
              </Link>
              <Link href="/legal/privacy" className="btn btn-ghost">
                Marketplace Privacy Policy
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </header>

          <section aria-labelledby="studio-apps-list-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  id="studio-apps-list-heading"
                  className="text-[20px] font-semibold tracking-tight text-ink"
                >
                  Published &amp; Release-Ready Titles
                </h2>
                <p className="muted mt-0.5 text-[13px]">
                  Select any app to view features, package details, and its dedicated Privacy Policy.
                </p>
              </div>
              <span className="badge tabular-nums">
                {apps.length} {apps.length === 1 ? "title" : "titles"}
              </span>
            </div>

            <div className="space-y-5">
              {apps.map((app) => (
                <article key={app.slug} className="surface overflow-hidden">
                  {app.bannerPath ? (
                    <div className="relative aspect-[2.2/1] max-h-[260px] w-full overflow-hidden border-b border-line bg-elevated">
                      <Image
                        src={app.bannerPath}
                        alt={`${app.name} feature graphic`}
                        width={1024}
                        height={500}
                        className="size-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <Image
                          src={app.iconPath}
                          alt={app.name}
                          width={64}
                          height={64}
                          className="size-16 shrink-0 rounded-[14px] border border-line object-cover shadow-xs"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="badge badge-positive">{app.statusLabel}</span>
                            <span className="badge">{app.category}</span>
                            <span className="badge font-mono">v{app.version}</span>
                          </div>
                          <h3 className="mt-2 text-[21px] font-bold tracking-tight text-ink">
                            {app.name}
                          </h3>
                          <p className="subtle mt-0.5 font-mono text-[12px]">
                            {app.platform} · {app.packageName}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link href={`/studios/${app.slug}`} className="btn btn-primary btn-sm">
                          <Gamepad2 className="size-3.5" aria-hidden />
                          App Overview
                        </Link>
                        <Link
                          href={`/studios/${app.slug}/privacy`}
                          className="btn btn-secondary btn-sm"
                        >
                          <ShieldCheck className="size-3.5 text-accent" aria-hidden />
                          Privacy Policy
                        </Link>
                        {app.playStoreUrl ? (
                          <a
                            href={app.playStoreUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            Google Play
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <p className="muted mt-4 text-[14px] leading-relaxed">{app.description}</p>

                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {app.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="flex items-start gap-2 rounded-[9px] border border-line bg-elevated/45 px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted"
                        >
                          <CheckCircle2
                            className="mt-0.5 size-3.5 shrink-0 text-positive"
                            aria-hidden
                          />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="surface-elevated p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-accent">
                <Layers className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-[16px] font-semibold text-ink">
                  Ready for Every Future Release
                </h2>
                <p className="muted mt-1 text-[13.5px] leading-relaxed">
                  Upcoming games and utility apps from KDILGAMES Software Studios automatically
                  appear in this hub and sidebar with their own store metadata, feature breakdown,
                  and dedicated Google Play privacy policy route.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
