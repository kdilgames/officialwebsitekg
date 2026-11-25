import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = (searchParams.get("title") ?? "KDILGAMES").slice(0, 90);
  const subtitle = (
    searchParams.get("subtitle") ?? "Digital Marketplace & Independent Game Studio"
  ).slice(0, 150);
  const badge = (searchParams.get("badge") ?? "KDILGAMES").slice(0, 32);

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
          background: "linear-gradient(135deg, #141413 0%, #1c2230 60%, #111827 100%)",
          color: "#faf9f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "20px",
                color: "#ffffff",
              }}
            >
              K
            </div>
            <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "0.06em" }}>
              KDILGAMES
            </span>
          </div>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(37,99,235,0.22)",
              fontSize: "18px",
              fontWeight: 600,
              color: "#93c5fd",
            }}
          >
            {badge}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "1000px" }}>
          <div style={{ fontSize: "54px", fontWeight: 800, lineHeight: 1.12 }}>{title}</div>
          <div style={{ fontSize: "24px", color: "#d1d5db", lineHeight: 1.4 }}>{subtitle}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.14)",
            paddingTop: "22px",
            fontSize: "18px",
            color: "#9ca3af",
          }}
        >
          <span>kdilgames.com</span>
          <span>Croatia (EU) · Verified Digital Releases</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
