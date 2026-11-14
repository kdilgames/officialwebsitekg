import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { env } from "@/lib/env";

import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-code",
});

export const metadata: Metadata = {
  title: {
    default: `${env.marketplace.platformName} — Digital Marketplace for Game Developers`,
    template: `%s · ${env.marketplace.platformName}`,
  },
  description:
    "Discover and buy Roblox systems, Minecraft plugins, Discord bots, website templates and developer tools from independent creators.",
  metadataBase: new URL(env.siteUrl),
  openGraph: { type: "website", siteName: env.marketplace.platformName },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
