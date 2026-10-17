import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { env } from "@/lib/env";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: `${env.marketplace.platformName} Marketplace`,
    template: `%s · ${env.marketplace.platformName}`,
  },
  description:
    "Marketplace for Roblox systems, Minecraft plugins, Discord bots, website templates and developer tooling.",
  metadataBase: new URL(env.siteUrl),
  openGraph: { type: "website", siteName: env.marketplace.platformName },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
