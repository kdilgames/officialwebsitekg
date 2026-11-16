import type { Metadata } from "next";

import { StudioPrivacyDocument } from "@/components/studios/privacy-document";
import { StudiosSidebar } from "@/components/studios/studios-sidebar";
import { STUDIO_GENERAL_PRIVACY } from "@/lib/studios/apps";

export const metadata: Metadata = {
  title: "Privacy Policy — KDILGAMES Software Studios",
  description:
    "General Privacy Policy covering mobile applications and games developed by KDILGAMES Software Studios.",
};

export default function StudiosGeneralPrivacyPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <StudiosSidebar activePath="/studios/privacy" />

        <StudioPrivacyDocument
          title="KDILGAMES Software Studios — Apps & Games Privacy Policy"
          subtitle={STUDIO_GENERAL_PRIVACY.summary}
          effectiveDate={STUDIO_GENERAL_PRIVACY.effectiveDate}
          lastUpdated={STUDIO_GENERAL_PRIVACY.lastUpdated}
          version={STUDIO_GENERAL_PRIVACY.version}
          canonicalPath="/studios/privacy"
          sections={STUDIO_GENERAL_PRIVACY.sections}
        />
      </div>
    </div>
  );
}
