import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  FileText,
  Gamepad2,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { STUDIO_SOCIAL_LINKS, listStudioApps } from "@/lib/studios/apps";
import { cn } from "@/lib/utils/cn";

export function StudiosSidebar({ activePath }: { activePath: string }) {
  const apps = listStudioApps();

  return (
    <aside
      aria-label="KDILGAMES Software Studios navigation"
      className="space-y-4 lg:sticky lg:top-20"
    >
      <div className="surface overflow-hidden">
        <div className="border-b border-line bg-elevated/60 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#2d3545] bg-gradient-to-b from-[#1e2430] to-[#11141c] p-1.5 shadow-xs">
              <Image
                src="/images/studios/kdil-studios-logo.png"
                alt="KDILGAMES Software Studios"
                width={64}
                height={64}
                className="size-full object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">
                In-House Division
              </p>
              <h2 className="truncate text-[14.5px] font-semibold text-ink">
                KDILGAMES Software Studios
              </h2>
            </div>
          </div>
          <p className="muted mt-3 text-[12.5px] leading-relaxed">
            First-party mobile games and developer apps crafted in-house, with dedicated product
            pages and transparent per-app privacy policies.
          </p>
        </div>

        <nav className="space-y-1 p-2.5" aria-label="Studio pages">
          <SidebarLink
            href="/studios"
            active={activePath === "/studios"}
            icon={<Sparkles className="size-3.5" aria-hidden />}
          >
            Studio Hub &amp; All Apps
          </SidebarLink>
          <SidebarLink
            href="/studios/privacy"
            active={activePath === "/studios/privacy" || activePath === "/privacy"}
            icon={<ShieldCheck className="size-3.5" aria-hidden />}
          >
            Studios Privacy Policy
          </SidebarLink>
          <SidebarLink
            href="/studios/terms"
            active={activePath === "/studios/terms"}
            icon={<FileText className="size-3.5" aria-hidden />}
          >
            Studios Terms of Service
          </SidebarLink>
        </nav>

        <div className="border-t border-line p-3">
          <p className="subtle px-1 text-[11px] font-semibold uppercase tracking-[0.05em]">
            Apps &amp; Games ({apps.length})
          </p>
          <div className="mt-2 space-y-2">
            {apps.map((app) => {
              const isAppPage = activePath === `/studios/${app.slug}`;
              const isAppPrivacy = activePath === `/studios/${app.slug}/privacy`;
              const isAppTerms = activePath === `/studios/${app.slug}/terms`;
              return (
                <div
                  key={app.slug}
                  className={cn(
                    "rounded-[10px] border p-2.5 transition-colors",
                    isAppPage || isAppPrivacy || isAppTerms
                      ? "border-accent/40 bg-accent-quiet/50"
                      : "border-line bg-canvas/50 hover:border-line-strong",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Image
                      src={app.iconPath}
                      alt={app.name}
                      width={36}
                      height={36}
                      className="size-9 shrink-0 rounded-[8px] border border-line object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{app.name}</p>
                      <p className="subtle truncate text-[11px]">
                        v{app.version} · {app.kind}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Link
                      href={`/studios/${app.slug}`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11.5px] font-medium transition-colors",
                        isAppPage
                          ? "bg-accent text-white"
                          : "border border-line bg-surface text-ink-muted hover:text-ink",
                      )}
                    >
                      <Gamepad2 className="size-3" aria-hidden />
                      Overview
                    </Link>
                    <Link
                      href={`/studios/${app.slug}/privacy`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11.5px] font-medium transition-colors",
                        isAppPrivacy
                          ? "bg-accent text-white"
                          : "border border-line bg-surface text-ink-muted hover:text-ink",
                      )}
                    >
                      <ShieldCheck className="size-3" aria-hidden />
                      Privacy
                    </Link>
                    <Link
                      href={`/studios/${app.slug}/terms`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11.5px] font-medium transition-colors",
                        isAppTerms
                          ? "bg-accent text-white"
                          : "border border-line bg-surface text-ink-muted hover:text-ink",
                      )}
                    >
                      <FileText className="size-3" aria-hidden />
                      Terms
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="surface p-4">
        <p className="subtle text-[11px] font-semibold uppercase tracking-[0.05em]">
          Studio Community
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {STUDIO_SOCIAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="badge transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
            >
              {link.label}
              <ExternalLink className="size-2.5 text-ink-subtle" aria-hidden />
            </a>
          ))}
        </div>

        <div className="divider my-3.5" />

        <Link
          href="/legal/privacy"
          className="group flex items-center justify-between gap-2 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-accent"
        >
          <span className="inline-flex items-center gap-1.5">
            <Scale className="size-3.5 text-ink-subtle group-hover:text-accent" aria-hidden />
            Marketplace Privacy Policy
          </span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-accent-quiet text-accent-ink"
          : "text-ink-muted hover:bg-elevated hover:text-ink",
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
