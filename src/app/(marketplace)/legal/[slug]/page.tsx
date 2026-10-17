import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { findDefaultLegalPage } from "@/lib/legal/content";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

/**
 * Policies are stored in the database so they can be revised without a
 * deployment. The documents shipped with the application are the fallback, so
 * every link in the footer resolves on a fresh installation.
 */
async function loadLegalPage(slug: string) {
  const stored = await prisma.legalPage.findFirst({
    where: { slug, isPublished: true },
    select: { title: true, summary: true, body: true, version: true, updatedAt: true },
  });

  if (stored) return { ...stored, updatedAt: stored.updatedAt as Date | null };

  const fallback = findDefaultLegalPage(slug);
  if (!fallback) return null;

  return {
    title: fallback.title,
    summary: fallback.summary,
    body: fallback.body,
    version: fallback.version,
    updatedAt: null,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadLegalPage(slug);
  if (!page) return { title: "Not found" };
  return { title: page.title, description: page.summary ?? undefined };
}

export default async function LegalPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = await loadLegalPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8">
      <Link
        href="/support"
        className="subtle mb-4 inline-flex items-center gap-1.5 text-[12px] hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Help centre
      </Link>

      <Card>
        <CardBody className="space-y-2">
          <div className="flex items-center gap-2 text-ink-subtle">
            <FileText className="size-4" aria-hidden />
            <span className="subtle text-[11px] uppercase tracking-[0.06em]">Policy</span>
          </div>
          <h1 className="text-[21px] font-semibold tracking-tight">{page.title}</h1>
          {page.summary ? (
            <p className="muted text-[13px] leading-relaxed">{page.summary}</p>
          ) : null}
          <p className="subtle text-[11.5px]">
            Version {page.version}
            {page.updatedAt ? ` · updated ${page.updatedAt.toISOString().slice(0, 10)}` : ""}
          </p>
        </CardBody>
      </Card>

      <div className="mt-5">
        <LegalBody body={page.body} />
      </div>

      <p className="subtle mt-8 border-t border-line pt-4 text-[11.5px] leading-relaxed">
        Questions about this policy, or a request relating to your personal data, can be raised in
        the{" "}
        <Link href="/support" className="text-accent hover:underline">
          support centre
        </Link>
        .
      </p>
    </div>
  );
}

/** Splits a line into text and `**strong**` runs. */
function renderInline(text: string): ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part.length > 0)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index} className="font-medium text-ink">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}

/**
 * Renders the small subset of Markdown the policy documents use: `##` headings,
 * paragraphs, `-` bullets and `1.` steps. Anything else is shown as text.
 */
function LegalBody({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  let ordered = false;

  const flush = () => {
    if (items.length === 0) return;
    const key = `list-${blocks.length}`;
    blocks.push(
      ordered ? (
        <ol key={key}>
          {items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key}>
          {items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ul>
      ),
    );
    items = [];
  };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();

    if (line.startsWith("## ")) {
      flush();
      blocks.push(
        <h2 key={`h-${blocks.length}`} className="text-[15px] font-semibold">
          {line.slice(3)}
        </h2>,
      );
      continue;
    }

    if (line.startsWith("- ")) {
      if (ordered) flush();
      ordered = false;
      items.push(line.slice(2));
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      if (!ordered) flush();
      ordered = true;
      items.push(line.replace(/^\d+\.\s/, ""));
      continue;
    }

    if (line.length === 0) {
      flush();
      continue;
    }

    flush();
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
  }

  flush();

  return <div className="prose-legal">{blocks}</div>;
}
