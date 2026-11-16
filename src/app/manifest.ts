import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${env.marketplace.platformName} — Digital Marketplace`,
    short_name: env.marketplace.platformName,
    description:
      "Discover and buy Roblox systems, Minecraft plugins, Discord bots, website templates and developer tools.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f5",
    theme_color: "#151921",
    icons: [
      {
        src: "/images/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/images/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
