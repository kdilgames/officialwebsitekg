import { ImageResponse } from "next/og";

import { getBlogPostBySlug } from "@/lib/blog/posts";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "KDILGAMES Blog Article";

export default async function BlogOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  const title = (post?.locales.en.title ?? "KDILGAMES Blog").slice(0, 90);
  const excerpt = (
    post?.locales.en.excerpt ?? "Engineering notes, game devlogs, and creator guides."
  ).slice(0, 145);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: "linear-gradient(135deg, #141413 0%, #262624 100%)",
          color: "#faf9f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "0.06em" }}>
            KDILGAMES BLOG
          </span>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            {post?.category ?? "Article"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "1020px" }}>
          <div style={{ fontSize: "48px", fontWeight: 800, lineHeight: 1.15 }}>{title}</div>
          <div style={{ fontSize: "23px", color: "#d6d3cd", lineHeight: 1.4 }}>{excerpt}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.16)",
            paddingTop: "20px",
            fontSize: "18px",
            color: "#a8a59e",
          }}
        >
          <span>
            {post ? `${post.publishedAt} · ${post.readingMinutes} min read` : "KDILGAMES"}
          </span>
          <span>kdilgames.com/blog</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
