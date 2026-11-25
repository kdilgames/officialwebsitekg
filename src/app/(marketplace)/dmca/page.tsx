import type { Metadata } from "next";
import Link from "next/link";
import { Copyright, ShieldAlert } from "lucide-react";

import { DmcaNoticeForm } from "@/components/forms/dmca-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { submitDmcaNoticeAction } from "@/lib/legal/dmca-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DMCA & Copyright Takedown Notices",
  description:
    "Submit a formal DMCA or EU Digital Services Act copyright infringement takedown notice to KDILGAMES.",
};

export default async function DmcaPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;

  return (
    <div className="mx-auto max-w-[760px] space-y-5 px-4 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight">
          <Copyright className="size-5 text-accent" aria-hidden />
          DMCA &amp; Copyright Takedown Notice
        </h1>
        <p className="muted mt-1.5 text-[13px] leading-relaxed">
          KDILGAMES respects intellectual property rights and complies with the US Digital
          Millennium Copyright Act (17 U.S.C. § 512) and the EU Digital Services Act (DSA). Use the
          form below to request removal of allegedly infringing marketplace listings.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Before you submit"
          description="Incomplete or abusive notices cannot be processed."
        />
        <CardBody className="space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
            <span>
              Misrepresenting that material infringes your copyright may expose you to liability for
              damages. For general listing issues (broken files, spam, malware), please use the{" "}
              <Link href="/report" className="text-accent hover:underline">
                Report content
              </Link>{" "}
              flow instead.
            </span>
          </p>
          <p>
            When a valid takedown notice is actioned, we notify the affected creator and provide
            instructions for filing a counter-notice via{" "}
            <Link href="/support/new" className="text-accent hover:underline">
              Support
            </Link>
            .
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="File a takedown notice"
          description="You will receive a tracking reference number immediately upon submission."
        />
        <CardBody>
          <DmcaNoticeForm action={submitDmcaNoticeAction} defaultProductUrl={url} />
        </CardBody>
      </Card>
    </div>
  );
}
