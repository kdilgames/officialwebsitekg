import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { getBlogPostBySlug, getLocalizedBlogPost, listBlogPosts } from "@/lib/blog/posts";
import { env } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server";
import { buildBlogPostJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const raw = getBlogPostBySlug(slug);
  if (!raw) return { title: "Article not found" };

  const locale = await getServerLocale();
  const post = getLocalizedBlogPost(raw, locale);

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const raw = getBlogPostBySlug(slug);
  if (!raw) notFound();

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const post = getLocalizedBlogPost(raw, locale);
  const related = listBlogPosts()
    .filter((entry) => entry.slug !== post.slug)
    .map((entry) => getLocalizedBlogPost(entry, locale));

  const jsonLd = buildBlogPostJsonLd({
    siteUrl: env.siteUrl,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    author: post.author,
    tags: post.tags,
  });

  return (
    <article className="mx-auto max-w-[820px] space-y-6 px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {dict.blog.backToBlog}
      </Link>

      <header className="space-y-3 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{post.category}</Badge>
          <span className="subtle inline-flex items-center gap-1 text-[12px]">
            <CalendarDays className="size-3.5" aria-hidden />
            {post.publishedAt}
          </span>
          <span className="subtle inline-flex items-center gap-1 text-[12px]">
            <Clock className="size-3.5" aria-hidden />
            {post.readingMinutes} {dict.blog.minRead}
          </span>
          <span className="subtle inline-flex items-center gap-1 text-[12px]">
            <User className="size-3.5" aria-hidden />
            {post.author}
          </span>
        </div>

        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">
          {post.title}
        </h1>
        <p className="muted text-[15px] leading-relaxed">{post.excerpt}</p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {post.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      </header>

      <Card>
        <CardBody className="space-y-6 p-6 sm:p-8">
          {post.sections.map((section) => (
            <section key={section.heading} className="space-y-2.5">
              <h2 className="text-[19px] font-semibold tracking-tight text-ink">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="muted text-[14.5px] leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </CardBody>
      </Card>

      {related.length > 0 ? (
        <section className="space-y-3 pt-2">
          <h2 className="text-[16px] font-semibold text-ink">{dict.blog.morePosts}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((entry) => (
              <Link
                key={entry.slug}
                href={`/blog/${entry.slug}`}
                className="surface card-interactive block p-4"
              >
                <p className="subtle text-[11.5px]">{entry.publishedAt}</p>
                <p className="mt-1 text-[14.5px] font-semibold text-ink">{entry.title}</p>
                <p className="muted mt-1 line-clamp-2 text-[12.5px]">{entry.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
