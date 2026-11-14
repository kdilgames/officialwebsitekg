"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileArchive, Image as ImageIcon, PlayCircle } from "lucide-react";

import { parseVideoEmbedUrl } from "@/lib/utils/media";

export type GalleryImage = { url: string; alt: string | null };

/**
 * Cover image with a scrollable thumbnail rail and optional privacy-enhanced video preview.
 *
 * Screenshots are stored at a 2:1 ratio (1024×512 recommended); anything else is
 * centre-cropped so the grid stays even.
 */
export function ProductGallery({
  images,
  title,
  videoUrl,
}: {
  images: GalleryImage[];
  title: string;
  videoUrl?: string | null;
}) {
  const video = parseVideoEmbedUrl(videoUrl);
  const total = images.length;
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"images" | "video">(total === 0 && video ? "video" : "images");

  if (total === 0 && !video) {
    return (
      <div className="flex aspect-[2/1] flex-col items-center justify-center gap-2 border-b border-line bg-elevated text-ink-subtle">
        <FileArchive className="size-8" aria-hidden />
        <span className="text-[12px]">No preview screenshots uploaded</span>
      </div>
    );
  }

  const active = Math.min(index, Math.max(0, total - 1));
  const current = images[active];
  const step = (delta: number) => setIndex((value) => (value + delta + total) % total);

  return (
    <div>
      {video ? (
        <div className="flex items-center justify-between border-b border-line bg-elevated/50 px-3 py-2">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Media view">
            {total > 0 ? (
              <button
                type="button"
                role="tab"
                aria-selected={mode === "images"}
                onClick={() => setMode("images")}
                className={`btn btn-sm ${
                  mode === "images" ? "btn-primary" : "btn-ghost text-ink-muted"
                }`}
              >
                <ImageIcon className="size-3.5" aria-hidden />
                Screenshots ({total})
              </button>
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={mode === "video"}
              onClick={() => setMode("video")}
              className={`btn btn-sm ${
                mode === "video" ? "btn-primary" : "btn-ghost text-ink-muted"
              }`}
            >
              <PlayCircle className="size-3.5" aria-hidden />
              Video preview
            </button>
          </div>
          <span className="subtle text-[11px] capitalize">{video.provider} showcase</span>
        </div>
      ) : null}

      {mode === "video" && video ? (
        <div className="relative aspect-[2/1] border-b border-line bg-black">
          <iframe
            src={video.embedUrl}
            title={`${title} video preview`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full border-0"
          />
        </div>
      ) : current ? (
        <div className="relative aspect-[2/1] border-b border-line bg-elevated">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts */}
          <img
            src={current.url}
            alt={current.alt ?? title}
            className="size-full object-cover"
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") step(-1);
              if (event.key === "ArrowRight") step(1);
            }}
            tabIndex={total > 1 ? 0 : -1}
          />

          {total > 1 ? (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-line bg-surface/90 p-2 text-ink shadow-sm backdrop-blur-xs transition-colors hover:bg-surface"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-line bg-surface/90 p-2 text-ink shadow-sm backdrop-blur-xs transition-colors hover:bg-surface"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <span className="badge absolute right-3 top-3 bg-surface/90 text-ink shadow-xs backdrop-blur-xs tabular-nums">
                {active + 1} / {total}
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      {mode === "images" && total > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3" role="tablist" aria-label="Product images">
          {images.map((image, position) => (
            <button
              key={image.url}
              type="button"
              role="tab"
              aria-selected={position === active}
              aria-label={`Show image ${position + 1}`}
              onClick={() => setIndex(position)}
              className={`shrink-0 overflow-hidden rounded-[8px] border-2 transition-all ${
                position === active
                  ? "border-accent shadow-xs"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts */}
              <img
                src={image.url}
                alt=""
                loading="lazy"
                className="aspect-[2/1] w-24 object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
