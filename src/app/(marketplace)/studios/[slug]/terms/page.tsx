import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { StudioPrivacyDocument } from "@/components/studios/privacy-document";
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
  if (!app) return { title: "Terms of Service" };
  return {
    title: `Terms of Service — ${app.name}`,
    description: app.termsOfService.summary,
  };
}

export default async function StudioAppTermsPage({
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
        <StudiosSidebar activePath={`/studios/${app.slug}/terms`} />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/studios/${app.slug}`}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to {app.name}
            </Link>
            <Link
              href={`/studios/${app.slug}/privacy`}
              className="text-[12.5px] font-medium text-accent hover:underline"
            >
              View {app.name} Privacy Policy
            </Link>
          </div>

          <StudioPrivacyDocument
            title={`Terms of Service for ${app.name}`}
            subtitle={app.termsOfService.summary}
            effectiveDate={app.termsOfService.effectiveDate}
            lastUpdated={app.termsOfService.lastUpdated}
            version={app.termsOfService.version}
            packageName={app.packageName}
            canonicalPath={`/studios/${app.slug}/terms`}
            badgeLabel="Google Play & EU DSA Terms of Service"
            routeLabel="Terms route"
            icon="terms"
            sections={app.termsOfService.sections}
          />
        </div>
      </div>
    </div>
  );
}
