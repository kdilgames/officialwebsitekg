import { describe, expect, it } from "vitest";

import { parseVideoEmbedUrl, safeHttpUrl } from "../media";

describe("safeHttpUrl", () => {
  it("accepts http and https URLs and rejects unsafe schemes", () => {
    expect(safeHttpUrl("https://demo.example.com/app")).toBe("https://demo.example.com/app");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
  });
});

describe("parseVideoEmbedUrl", () => {
  it("extracts privacy-enhanced YouTube embeds across URL formats", () => {
    expect(parseVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    });
    expect(parseVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=12")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    });
    expect(parseVideoEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    });
  });

  it("extracts Vimeo embeds and rejects arbitrary domains", () => {
    expect(parseVideoEmbedUrl("https://vimeo.com/76979871")).toEqual({
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/76979871",
    });
    expect(parseVideoEmbedUrl("https://evil.example.com/video.mp4")).toBeNull();
  });
});
