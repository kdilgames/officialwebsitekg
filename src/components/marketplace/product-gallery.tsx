"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileArchive } from "lucide-react";

export type GalleryImage = { url: string; alt: string | null };

/**
 * Cover image with a scrollable thumbnail rail.
 *
 * Screenshots are stored at a 2:1 ratio (1024×512 recommended); anything else is
 * centre-cropped so the grid stays even.
 */
export function ProductGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const total = images.length;

  if (total === 0) {
    return (
      <div className="flex aspect-[2/1] items-center justify-center border-b border-line bg-elevated text-ink-subtle">
        <FileArchive className="size-8" aria-hidden />
      </div>
    );
  }

  const active = Math.min(index, total - 1);
  const current = images[active] as GalleryImage;
  const step = (delta: number) => setIndex((value) => (value + delta + total) % total);

  return (
    <div>
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
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-line bg-canvas/85 p-1.5 text-ink-muted transition-colors hover:text-ink"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-line bg-canvas/85 p-1.5 text-ink-muted transition-colors hover:text-ink"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <span className="badge absolute right-2 top-2 tabular-nums">
              {active + 1} / {total}
            </span>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3" role="tablist" aria-label="Product images">
          {images.map((image, position) => (
            <button
              key={image.url}
              type="button"
              role="tab"
              aria-selected={position === active}
              aria-label={`Show image ${position + 1}`}
              onClick={() => setIndex(position)}
              className={`shrink-0 overflow-hidden rounded-[6px] border transition-colors ${
                position === active ? "border-accent" : "border-line hover:border-line-strong"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote host configured in next.config.ts */}
              <img
                src={image.url}
                alt=""
                loading="lazy"
                className={`aspect-[2/1] w-24 object-cover ${position === active ? "" : "opacity-70"}`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
