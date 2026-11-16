import Link from "next/link";
import { ArrowRight, ExternalLink, FileText, ShieldCheck } from "lucide-react";

import type { StudioPrivacySection } from "@/lib/studios/apps";

export function StudioPrivacyDocument({
  title,
  subtitle,
  effectiveDate,
  lastUpdated,
  version,
  packageName,
  canonicalPath,
  dataSafety,
  sections,
  badgeLabel = "Google Play & Store Privacy Policy",
  routeLabel = "Policy route",
  icon = "privacy",
}: {
  title: string;
  subtitle: string;
  effectiveDate: string;
  lastUpdated: string;
  version: string;
  packageName?: string;
  canonicalPath: string;
  dataSafety?: { label: string; value: string }[];
  sections: StudioPrivacySection[];
  badgeLabel?: string;
  routeLabel?: string;
  icon?: "privacy" | "terms";
}) {
  return (
    <div className="space-y-6">
      <div className="surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-accent">
            {icon === "terms" ? (
              <FileText className="size-3" aria-hidden />
            ) : (
              <ShieldCheck className="size-3" aria-hidden />
            )}
            {badgeLabel}
          </span>
          <span className="badge">Version {version}</span>
          {packageName ? <span className="badge font-mono">{packageName}</span> : null}
        </div>

        <h1 className="mt-4 text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[32px]">
          {title}
        </h1>
        <p className="muted mt-2 max-w-2xl text-[14.5px] leading-relaxed">{subtitle}</p>

        <dl className="mt-5 grid gap-3 rounded-[10px] border border-line bg-elevated/60 p-4 text-[12.5px] sm:grid-cols-3">
          <div>
            <dt className="subtle font-medium uppercase tracking-[0.04em]">Effective date</dt>
            <dd className="mt-0.5 font-semibold text-ink">{effectiveDate}</dd>
          </div>
          <div>
            <dt className="subtle font-medium uppercase tracking-[0.04em]">Last updated</dt>
            <dd className="mt-0.5 font-semibold text-ink">{lastUpdated}</dd>
          </div>
          <div>
            <dt className="subtle font-medium uppercase tracking-[0.04em]">{routeLabel}</dt>
            <dd className="mt-0.5 truncate font-mono text-[12px] text-accent">{canonicalPath}</dd>
          </div>
        </dl>

        {dataSafety && dataSafety.length > 0 ? (
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {dataSafety.map((item) => (
              <div
                key={item.label}
                className="rounded-[9px] border border-line bg-canvas/60 px-3.5 py-2.5"
              >
                <p className="subtle text-[11px] font-semibold uppercase tracking-[0.04em]">
                  {item.label}
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="divider my-7" />

        <div className="prose-legal text-[14px]">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {section.links && section.links.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {section.links.map((link) =>
                    link.external ? (
                      <a
                        key={link.href + link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        {link.label}
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : (
                      <Link
                        key={link.href + link.label}
                        href={link.href}
                        className="btn btn-secondary btn-sm"
                      >
                        {link.label}
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    ),
                  )}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
