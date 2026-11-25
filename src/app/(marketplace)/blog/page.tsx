import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Clock } from "lucide-react";

import { NewsletterSection } from "@/components/marketing/newsletter-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { getLocalizedBlogPost, listBlogPosts } from "@/lib/blog/posts";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server";
import { subscribeNewsletterAction } from "@/lib/newsletter/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Devlogs from ByteRack Tycoon, marketplace engineering notes, and guides for indie game creators.",
};

export default async function BlogIndexPage() {
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const posts = listBlogPosts().map((post) => getLocalizedBlogPost(post, locale));

  return (
    <div className="mx-auto max-w-[1100px] space-y-8 px-4 py-8 sm:px-6">
      <header className="border-b border-line pb-6">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-accent">
          {dict.blog.eyebrow}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-[26px] font-bold tracking-tight text-ink">
          <BookOpen className="size-6 text-accent" aria-hidden />
          {dict.blog.heading}
        </h1>
        <p className="muted mt-2 max-w-2xl text-[14px] leading-relaxed">{dict.blog.subtitle}</p>
      </header>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Card key={post.slug} className="card-interactive flex flex-col overflow-hidden">
            <CardBody className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{post.category}</Badge>
                <span className="subtle inline-flex items-center gap-1 text-[11.5px]">
                  <CalendarDays className="size-3" aria-hidden />
                  {post.publishedAt}
                </span>
                <span className="subtle inline-flex items-center gap-1 text-[11.5px]">
                  <Clock className="size-3" aria-hidden />
                  {post.readingMinutes} {dict.blog.minRead}
                </span>
              </div>

              <h2 className="mt-3 text-[17px] font-semibold leading-snug text-ink">
                <Link href={`/blog/${post.slug}`} className="hover:text-accent">
                  {post.title}
                </Link>
              </h2>

              <p className="muted mt-2 text-[13px] leading-relaxed">{post.excerpt}</p>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <div className="flex flex-wrap gap-1">
                  {post.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline"
                >
                  {dict.blog.readArticle}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <NewsletterSection action={subscribeNewsletterAction} source="blog" locale={locale} />
    </div>
  );
}
