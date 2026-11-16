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
  if (!app) return { title: "Privacy Policy" };
  return {
    title: `Privacy Policy — ${app.name}`,
    description: app.privacyPolicy.summary,
  };
}

export default async function StudioAppPrivacyPage({
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
        <StudiosSidebar activePath={`/studios/${app.slug}/privacy`} />

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
              href="/studios/privacy"
              className="text-[12.5px] font-medium text-accent hover:underline"
            >
              View all studio privacy policies
            </Link>
          </div>

          <StudioPrivacyDocument
            title={`Privacy Policy for ${app.name}`}
            subtitle={app.privacyPolicy.summary}
            effectiveDate={app.privacyPolicy.effectiveDate}
            lastUpdated={app.privacyPolicy.lastUpdated}
            version={app.privacyPolicy.version}
            packageName={app.packageName}
            canonicalPath={`/studios/${app.slug}/privacy`}
            dataSafety={app.dataSafety}
            sections={app.privacyPolicy.sections}
          />
        </div>
      </div>
    </div>
  );
}
