import type { Metadata } from "next";

import { StudioPrivacyDocument } from "@/components/studios/privacy-document";
import { StudiosSidebar } from "@/components/studios/studios-sidebar";
import { STUDIO_GENERAL_TERMS } from "@/lib/studios/apps";

export const metadata: Metadata = {
  title: "Terms of Service — KDILGAMES Software Studios",
  description:
    "General Terms of Service covering standalone mobile applications and games developed by KDILGAMES Software Studios.",
};

export default function StudiosGeneralTermsPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <StudiosSidebar activePath="/studios/terms" />

        <StudioPrivacyDocument
          title="KDILGAMES Software Studios — Apps & Games Terms of Service"
          subtitle={STUDIO_GENERAL_TERMS.summary}
          effectiveDate={STUDIO_GENERAL_TERMS.effectiveDate}
          lastUpdated={STUDIO_GENERAL_TERMS.lastUpdated}
          version={STUDIO_GENERAL_TERMS.version}
          canonicalPath="/studios/terms"
          badgeLabel="Google Play & EU DSA Terms of Service"
          routeLabel="Terms route"
          icon="terms"
          sections={STUDIO_GENERAL_TERMS.sections}
        />
      </div>
    </div>
  );
}
