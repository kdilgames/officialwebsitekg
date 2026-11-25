import { ImageResponse } from "next/og";

import { getStudioGameBySlug } from "@/lib/studios/apps";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "KDILGAMES Original Game";

export default async function GameOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getStudioGameBySlug(slug);

  const title = game?.name ?? "KDILGAMES Software Studios";
  const subtitle = (
    game?.tagline ?? "Original offline-first indie games built by KDILGAMES Software Studios."
  ).slice(0, 145);
  const badge = game ? `${game.platform} · v${game.version}` : "Original Game";

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
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #1d4ed8 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "0.06em" }}>
            KDILGAMES SOFTWARE STUDIOS
          </span>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.16)",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            {badge}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "1020px" }}>
          <div style={{ fontSize: "60px", fontWeight: 800, lineHeight: 1.08 }}>{title}</div>
          <div style={{ fontSize: "24px", color: "#e2e8f0", lineHeight: 1.4 }}>{subtitle}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.22)",
            paddingTop: "20px",
            fontSize: "18px",
            color: "#cbd5e1",
          }}
        >
          <span>{game?.monetizationNote ?? "Free to play · Zero forced ads"}</span>
          <span>kdilgames.com/games/{slug}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
