import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Gamepad2,
  Layers,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { STUDIO_SOCIAL_LINKS, listStudioApps } from "@/lib/studios/apps";

export function StudiosHomepageSection() {
  const apps = listStudioApps();

  return (
    <section className="mt-12" aria-labelledby="kdil-software-studios-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-accent">
            Dedicated Studio Wing
          </p>
          <h2
            id="kdil-software-studios-heading"
            className="mt-0.5 text-[20px] font-semibold tracking-tight text-ink"
          >
            KDILGAMES Software Studios
          </h2>
          <p className="muted mt-0.5 text-[13px]">
            Alongside our creator marketplace, we develop our own mobile games and software apps —
            each with a dedicated page and privacy policy.
          </p>
        </div>
        <Link href="/studios" className="btn btn-ghost btn-sm text-ink-muted hover:text-ink">
          Open Software Studios
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start">
        {/* Side panel: KDILGAMES Software Studios ("sa strane") */}
        <aside className="surface overflow-hidden">
          <div className="border-b border-line bg-elevated/60 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-[#2d3545] bg-gradient-to-b from-[#1e2430] to-[#11141c] p-1.5 shadow-xs">
                <Image
                  src="/images/studios/kdil-studios-logo.png"
                  alt="KDILGAMES Software Studios logo"
                  width={72}
                  height={72}
                  className="size-full object-contain"
                />
              </span>
              <div className="min-w-0">
                <span className="badge badge-accent">Official Studio</span>
                <p className="mt-1 truncate text-[15px] font-semibold text-ink">
                  KDILGAMES Software Studios
                </p>
              </div>
            </div>

            <p className="muted mt-3 text-[13px] leading-relaxed">
              Every mobile game and app built under KDILGAMES Software Studios lives here in one
              organized hub — separate from marketplace seller listings.
            </p>
          </div>

          <div className="space-y-2 p-4">
            <Link href="/studios" className="btn btn-primary w-full justify-between">
              <span>Browse all studio apps</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/studios/privacy" className="btn btn-secondary w-full justify-between">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-accent" aria-hidden />
                Studios Privacy Policy
              </span>
              <ArrowRight className="size-3.5 text-ink-subtle" aria-hidden />
            </Link>
          </div>

          <div className="border-t border-line px-4 py-3.5">
            <p className="subtle text-[11px] font-semibold uppercase tracking-[0.05em]">
              Community Channels
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STUDIO_SOCIAL_LINKS.filter((item) => item.label !== "Website").map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
                >
                  {social.label}
                  <ExternalLink className="size-2.5 text-ink-subtle" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* Main showcase grid of Software Studios apps */}
        <div className="grid gap-4 sm:grid-cols-2">
          {apps.map((app) => (
            <article
              key={app.slug}
              className="surface card-interactive flex flex-col justify-between overflow-hidden"
            >
              <div>
                {app.bannerPath ? (
                  <Link
                    href={`/studios/${app.slug}`}
                    className="relative block aspect-[2.05/1] overflow-hidden border-b border-line bg-elevated"
                  >
                    <Image
                      src={app.bannerPath}
                      alt={`${app.name} feature graphic`}
                      width={1024}
                      height={500}
                      className="size-full object-cover"
                    />
                  </Link>
                ) : null}

                <div className="p-5">
                  <div className="flex items-start gap-3.5">
                    <Image
                      src={app.iconPath}
                      alt={app.name}
                      width={52}
                      height={52}
                      className="size-13 shrink-0 rounded-[11px] border border-line object-cover shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="badge badge-positive">{app.statusLabel}</span>
                        <span className="badge">v{app.version}</span>
                      </div>
                      <Link
                        href={`/studios/${app.slug}`}
                        className="mt-1.5 block text-[16.5px] font-semibold text-ink hover:text-accent"
                      >
                        {app.name}
                      </Link>
                      <p className="subtle text-[12px]">{app.platform}</p>
                    </div>
                  </div>

                  <p className="muted mt-3.5 text-[13px] leading-relaxed">{app.description}</p>
                  <p className="subtle mt-2.5 text-[12px]">{app.monetizationNote}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-elevated/50 px-5 py-3.5">
                <Link href={`/studios/${app.slug}`} className="btn btn-primary btn-sm">
                  <Gamepad2 className="size-3.5" aria-hidden />
                  App page
                </Link>
                <Link href={`/studios/${app.slug}/privacy`} className="btn btn-secondary btn-sm">
                  <ShieldCheck className="size-3.5 text-accent" aria-hidden />
                  Privacy Policy
                </Link>
              </div>
            </article>
          ))}

          {/* Extensible slot showing visitors where future releases appear */}
          <div className="surface-elevated flex flex-col justify-between p-5">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-[10px] border border-line bg-surface text-accent">
                  <Layers className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold text-ink">
                    Built for Upcoming Releases
                  </p>
                  <p className="subtle text-[12px]">Android · Utilities · Simulation Games</p>
                </div>
              </div>
              <p className="muted mt-3.5 text-[13px] leading-relaxed">
                Every upcoming title launched by KDILGAMES Software Studios will be added right
                here with its own overview page, store link, and standalone Google Play privacy
                policy URL.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
              <span className="subtle inline-flex items-center gap-1.5 text-[12px]">
                <Smartphone className="size-3.5 text-accent" aria-hidden />
                Centralized Studios Hub
              </span>
              <Link
                href="/studios"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline"
              >
                View Studios Hub
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
