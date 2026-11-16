import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, ShieldCheck } from "lucide-react";

import { StudiosSidebar } from "@/components/studios/studios-sidebar";
import { STUDIO_APPS, getStudioAppBySlug } from "@/lib/studios/apps";

export function generateStaticParams() {
  return STUDIO_APPS.map((app) => ({ slug: app.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const app = getStudioAppBySlug(slug);
  if (!app) return { title: "App not found" };
  return {
    title: `${app.name} — KDILGAMES Software Studios`,
    description: app.tagline,
  };
}

export default async function StudioAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const app = getStudioAppBySlug(slug);
  if (!app) notFound();

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <StudiosSidebar activePath={`/studios/${app.slug}`} />

        <div className="space-y-6">
          <div>
            <Link
              href="/studios"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              All KDILGAMES Software Studios apps
            </Link>
          </div>

          <article className="surface overflow-hidden">
            {app.bannerPath ? (
              <div className="relative aspect-[2.1/1] max-h-[300px] w-full overflow-hidden border-b border-line bg-elevated">
                <Image
                  src={app.bannerPath}
                  alt={`${app.name} banner`}
                  width={1024}
                  height={500}
                  priority
                  className="size-full object-cover"
                />
              </div>
            ) : null}

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Image
                    src={app.iconPath}
                    alt={app.name}
                    width={72}
                    height={72}
                    className="size-18 shrink-0 rounded-[16px] border border-line object-cover shadow-xs"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="badge badge-positive">{app.statusLabel}</span>
                      <span className="badge">{app.category}</span>
                      <span className="badge font-mono">v{app.version}</span>
                    </div>
                    <h1 className="mt-2 text-[26px] font-bold tracking-[-0.02em] text-ink sm:text-[32px]">
                      {app.name}
                    </h1>
                    <p className="subtle mt-0.5 font-mono text-[12.5px]">
                      {app.platform} · {app.packageName}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/studios/${app.slug}/privacy`} className="btn btn-primary">
                    <ShieldCheck className="size-4" aria-hidden />
                    Read Privacy Policy
                  </Link>
                  <Link href={`/studios/${app.slug}/terms`} className="btn btn-secondary">
                    <FileText className="size-4 text-accent" aria-hidden />
                    Terms of Service
                  </Link>
                  {app.playStoreUrl ? (
                    <a
                      href={app.playStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                    >
                      Get on Google Play
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </div>

              <p className="muted mt-5 text-[15px] leading-relaxed">{app.description}</p>
              <p className="mt-2 text-[13px] font-medium text-ink">{app.monetizationNote}</p>

              <div className="divider my-6" />

              <h2 className="text-[17px] font-semibold text-ink">Key Features</h2>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {app.highlights.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 rounded-[10px] border border-line bg-elevated/50 p-3.5 text-[13px] leading-relaxed text-ink-muted"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="divider my-6" />

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] border border-line bg-elevated/60 p-4 sm:p-5">
                <div>
                  <h2 className="text-[15.5px] font-semibold text-ink">
                    Privacy &amp; Google Play Data Safety
                  </h2>
                  <p className="muted mt-0.5 text-[13px]">
                    Dedicated privacy policy URL for Google Play Store and in-app verification.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/studios/${app.slug}/privacy`} className="btn btn-secondary btn-sm">
                    <ShieldCheck className="size-3.5 text-accent" aria-hidden />
                    /studios/{app.slug}/privacy
                  </Link>
                  <Link href={`/studios/${app.slug}/terms`} className="btn btn-secondary btn-sm">
                    <FileText className="size-3.5 text-accent" aria-hidden />
                    /studios/{app.slug}/terms
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
