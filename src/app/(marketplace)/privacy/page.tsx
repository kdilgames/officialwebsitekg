import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale, ShieldCheck } from "lucide-react";

import { StudioPrivacyDocument } from "@/components/studios/privacy-document";
import { StudiosSidebar } from "@/components/studios/studios-sidebar";
import { getStudioAppBySlug } from "@/lib/studios/apps";

export const metadata: Metadata = {
  title: "Privacy Policy — KDILGAMES Software Studios & ByteRack Tycoon",
  description:
    "Official Privacy Policy for KDILGAMES Software Studios mobile apps and games (including ByteRack Tycoon), plus quick access to the Digital Marketplace Privacy Policy.",
};

export default function RootPrivacyPage() {
  const byteRack = getStudioAppBySlug("byterack-tycoon");

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <StudiosSidebar activePath="/privacy" />

        <div className="space-y-5">
          <div className="surface-elevated flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="text-[13.5px] font-semibold text-ink">
                  Looking for a specific privacy notice?
                </p>
                <p className="muted text-[12.5px]">
                  This page covers ByteRack Tycoon &amp; KDILGAMES Software Studios apps. For the
                  web marketplace (accounts &amp; Stripe checkout), read the Marketplace Legal page.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/studios/byterack-tycoon/privacy" className="btn btn-secondary btn-sm">
                ByteRack Tycoon URL
              </Link>
              <Link href="/legal/privacy" className="btn btn-secondary btn-sm">
                <Scale className="size-3.5" aria-hidden />
                Marketplace Privacy
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          </div>

          {byteRack ? (
            <StudioPrivacyDocument
              title={`Privacy Policy — ${byteRack.name} (KDILGAMES Software Studios)`}
              subtitle={byteRack.privacyPolicy.summary}
              effectiveDate={byteRack.privacyPolicy.effectiveDate}
              lastUpdated={byteRack.privacyPolicy.lastUpdated}
              version={byteRack.privacyPolicy.version}
              packageName={byteRack.packageName}
              canonicalPath="/privacy"
              dataSafety={byteRack.dataSafety}
              sections={byteRack.privacyPolicy.sections}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
