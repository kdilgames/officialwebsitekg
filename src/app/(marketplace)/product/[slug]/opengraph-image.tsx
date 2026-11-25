import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { withSchemaFallback } from "@/lib/db-compat";
import { formatMoney } from "@/lib/money";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "KDILGAMES Marketplace Product";

export default async function ProductOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await withSchemaFallback(
    () =>
      prisma.product.findFirst({
        where: { slug, status: "PUBLISHED" },
        select: {
          title: true,
          shortDescription: true,
          priceMinor: true,
          salePriceMinor: true,
          currency: true,
          ratingSum: true,
          ratingCount: true,
          category: { select: { name: true } },
          seller: { select: { storeName: true } },
        },
      }),
    null,
  );

  const title = (product?.title ?? "KDILGAMES Marketplace").slice(0, 80);
  const subtitle = (
    product?.shortDescription ??
    "Verified scripts, plugins, bots, and game dev assets on KDILGAMES."
  ).slice(0, 140);
  const category = product?.category.name ?? "Marketplace";
  const storeName = product?.seller.storeName ?? "KDILGAMES";
  const effectiveMinor = product ? (product.salePriceMinor ?? product.priceMinor) : null;
  const priceLabel =
    effectiveMinor === null
      ? "Explore"
      : effectiveMinor === 0
        ? "Free"
        : formatMoney(effectiveMinor, product?.currency ?? "EUR");
  const ratingLabel =
    product && product.ratingCount > 0
      ? `★ ${(product.ratingSum / product.ratingCount).toFixed(1)} (${product.ratingCount})`
      : "Verified creator";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px 62px",
          background: "linear-gradient(135deg, #faf9f5 0%, #eef2ff 100%)",
          color: "#141413",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#141413",
                color: "#faf9f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "20px",
              }}
            >
              K
            </div>
            <span style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "0.05em" }}>
              KDILGAMES
            </span>
          </div>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              background: "#dbeafe",
              color: "#1d4ed8",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            {category}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1020px" }}>
          <div style={{ fontSize: "52px", fontWeight: 800, lineHeight: 1.12 }}>{title}</div>
          <div style={{ fontSize: "24px", color: "#57564f", lineHeight: 1.4 }}>{subtitle}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid #e5e4dc",
            paddingTop: "22px",
          }}
        >
          <div style={{ display: "flex", gap: "18px", fontSize: "20px", color: "#57564f" }}>
            <span style={{ fontWeight: 700, color: "#141413" }}>by {storeName}</span>
            <span>·</span>
            <span>{ratingLabel}</span>
          </div>
          <div
            style={{
              padding: "10px 24px",
              borderRadius: "10px",
              background: "#141413",
              color: "#ffffff",
              fontSize: "26px",
              fontWeight: 700,
            }}
          >
            {priceLabel}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
