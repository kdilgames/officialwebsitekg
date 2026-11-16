import { DEFAULT_OWNER_EMAIL, env } from "../env";

export type StudioPrivacyLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type StudioPrivacySection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  links?: StudioPrivacyLink[];
};

export type StudioAppStatus = "LIVE" | "RELEASE_CANDIDATE" | "COMING_SOON";

export type StudioApp = {
  slug: string;
  name: string;
  kind: "Game" | "App";
  category: string;
  platform: string;
  packageName: string;
  version: string;
  status: StudioAppStatus;
  statusLabel: string;
  tagline: string;
  description: string;
  iconPath: string;
  bannerPath?: string;
  playStoreUrl?: string;
  monetizationNote: string;
  highlights: string[];
  dataSafety: {
    label: string;
    value: string;
  }[];
  privacyPolicy: {
    effectiveDate: string;
    lastUpdated: string;
    version: string;
    summary: string;
    sections: StudioPrivacySection[];
  };
};

export const STUDIO_SOCIAL_LINKS = [
  { label: "Website", href: "https://kdilgames.com/" },
  {
    label: "Discord",
    href: env.marketplace.discordUrl ?? "https://discord.gg/kdilgames",
  },
  { label: "TikTok", href: "https://www.tiktok.com/@kdilgames" },
  { label: "Instagram", href: "https://www.instagram.com/kdilgames/" },
  { label: "X / Twitter", href: "https://x.com/KdilGames" },
] as const;

export const STUDIO_CONTACT_EMAIL = DEFAULT_OWNER_EMAIL;

/**
 * Registry of official applications and games released by KDILGAMES Software Studios.
 *
 * Adding a new app or game here automatically creates:
 *  - Its card in the KDILGAMES Software Studios showcase & sidebar navigation
 *  - Its dedicated product page at `/studios/<slug>`
 *  - Its dedicated Google Play-ready privacy policy page at `/studios/<slug>/privacy`
 */
export const STUDIO_APPS: StudioApp[] = [
  {
    slug: "byterack-tycoon",
    name: "ByteRack Tycoon",
    kind: "Game",
    category: "Simulation · Idle Tycoon",
    platform: "Android · Google Play",
    packageName: "com.karlo.byterack",
    version: "1.3.0",
    status: "RELEASE_CANDIDATE",
    statusLabel: "Google Play Ready",
    tagline:
      "Build your hosting studio from a bedroom rack into an Alpine data vault — offline-first and ad-free.",
    description:
      "Start in a small bedroom and grow your independent server hosting company into a full-scale data center. Manage thermals, recruit engineers, complete client contracts, and expand across 6 physical rooms with zero forced ads.",
    iconPath: "/images/studios/byterack-tycoon-icon.png",
    bannerPath: "/images/studios/byterack-tycoon-banner.png",
    monetizationNote: "Free to play · Optional one-time Founder Starter Pack · Zero third-party ads",
    highlights: [
      "6 expandable rooms: Small Bedroom, Home Garage, Brick Workshop, Metro Server Hall, Nordic Hydro Plant, and Alpine Summit Vault.",
      "8 server hardware tiers with 2x production milestones, manual tap combos & 5x Critical Packets, thermal management, and Turbo 2.5x boost.",
      "Recruit Luka, Maya, Leo, and Elena to automate packet handling, auto-vent heat, boost contract payouts, and protect offline earnings.",
      "Client Contracts, Supply Drops, 7-Day Daily Streak bonuses, permanent Tech Tree perks, and Light / Dark Studio themes.",
    ],
    dataSafety: [
      { label: "Personal Data Collected", value: "None (offline-first storage)" },
      { label: "Third-Party Ads / Trackers", value: "None" },
      { label: "Save Storage", value: "Local SharedPreferences & Android Auto Backup" },
      { label: "Optional Billing & Updates", value: "Google Play Billing & In-App Updates" },
    ],
    privacyPolicy: {
      effectiveDate: "November 16, 2026",
      lastUpdated: "November 16, 2026",
      version: "1.0",
      summary:
        "ByteRack Tycoon is an offline-first mobile game developed by KDILGAMES Software Studios without third-party advertisements, behavioural analytics, or personal data collection.",
      sections: [
        {
          heading: "1. Overview & Developer Identity",
          paragraphs: [
            'This Privacy Policy explains how KDILGAMES Software Studios ("we", "our", or "us") handles information in connection with the mobile application ByteRack Tycoon (package ID com.karlo.byterack).',
            "ByteRack Tycoon is designed as an offline-first game that runs directly on your device without requiring an account, login, or personal profile.",
          ],
        },
        {
          heading: "2. Data Stored Locally on Your Device",
          paragraphs: [
            "All gameplay state — including your virtual cash, server racks, cooling upgrades, staff hires, achievements, daily streak, audio preference, and light/dark theme choice — is saved locally on your device using Android SharedPreferences.",
            "If you have Android Auto Backup enabled in your Google or device settings, Android may back up your local save data to your personal Google Drive backup according to your system settings.",
            "KDILGAMES Software Studios does not operate external player-tracking servers for ByteRack Tycoon and does not collect, read, sell, or share your personal data.",
          ],
          bullets: [
            "No third-party advertising SDKs or advertising-ID tracking.",
            "No cross-app tracking or behavioural profiling.",
            "Uninstalling the app removes local device storage unless backed up by Android Auto Backup.",
          ],
        },
        {
          heading: "3. Google Play Services (Purchases & In-App Updates)",
          paragraphs: [
            "ByteRack Tycoon integrates official Google Play services solely for optional functionality initiated by the player or device:",
          ],
          bullets: [
            "Google Play Billing: If you choose to purchase the optional one-time Founder Starter Pack (product ID byterack_starter_pack), payment processing, receipts, and restoration are handled strictly by Google Play. KDILGAMES Software Studios never sees or stores your credit card number, billing address, or banking credentials.",
            "Google Play In-App Updates: When checking whether a newer version of ByteRack Tycoon is available on Google Play, your device communicates directly with Google Play services.",
          ],
          links: [
            {
              label: "Read Google Privacy Policy",
              href: "https://policies.google.com/privacy",
              external: true,
            },
          ],
        },
        {
          heading: "4. External Community Links",
          paragraphs: [
            "Inside the in-game Office and Settings panels, optional buttons link to KDILGAMES Software Studios' official website, Discord server, TikTok, Instagram, and X / Twitter pages.",
            "Tapping an external link opens your device browser or the corresponding app outside of ByteRack Tycoon. Once you leave the game, your interaction is governed by that platform's own privacy policy.",
          ],
        },
        {
          heading: "5. Children's Privacy",
          paragraphs: [
            "Because ByteRack Tycoon does not require registration or transmit personal data to our servers, we do not knowingly collect personal information from children under 13 (or the applicable age of digital consent in your country) or from any other users.",
          ],
        },
        {
          heading: "6. Changes to This Policy",
          paragraphs: [
            "If future versions of ByteRack Tycoon introduce optional online features such as cloud saves or leaderboards, this Privacy Policy will be updated before those features go live and the revised date will appear at the top of this page.",
          ],
        },
        {
          heading: "7. Contact Us",
          paragraphs: [
            `If you have any questions about privacy in ByteRack Tycoon, please contact KDILGAMES Software Studios at ${DEFAULT_OWNER_EMAIL} or via our official Discord server.`,
          ],
          links: [
            {
              label: `Email ${DEFAULT_OWNER_EMAIL}`,
              href: `mailto:${DEFAULT_OWNER_EMAIL}`,
              external: true,
            },
            {
              label: "Join KDILGAMES Discord",
              href: env.marketplace.discordUrl ?? "https://discord.gg/kdilgames",
              external: true,
            },
          ],
        },
      ],
    },
  },
];

export const STUDIO_GENERAL_PRIVACY: {
  effectiveDate: string;
  lastUpdated: string;
  version: string;
  summary: string;
  sections: StudioPrivacySection[];
} = {
  effectiveDate: "November 16, 2026",
  lastUpdated: "November 16, 2026",
  version: "1.0",
  summary:
    "General Privacy Policy for standalone mobile apps and games developed and published by KDILGAMES Software Studios (separate from the KDILGAMES Digital Marketplace).",
  sections: [
    {
      heading: "1. Scope of This Policy",
      paragraphs: [
        "This Privacy Policy covers standalone mobile applications and games released under KDILGAMES Software Studios (for example, on Google Play), including ByteRack Tycoon and upcoming studio titles.",
        "If you browse listings, create an account, or complete a Stripe purchase on the KDILGAMES Digital Marketplace website, the separate Marketplace Privacy Policy governs website accounts and marketplace transactions.",
      ],
      links: [
        {
          label: "Marketplace Privacy Policy",
          href: "/legal/privacy",
        },
      ],
    },
    {
      heading: "2. Privacy-First App Design",
      paragraphs: [
        "KDILGAMES Software Studios builds lightweight, player-friendly software that minimizes or eliminates personal data collection:",
      ],
      bullets: [
        "Offline-first progression is saved locally on your device unless a title explicitly documents optional cloud features.",
        "Where platform billing or updates are used (such as Google Play Billing or Google Play In-App Updates), transactions are processed directly by Google under Google's Privacy Policy.",
        "KDILGAMES Software Studios does not sell personal information to data brokers or third-party ad networks.",
      ],
      links: [
        {
          label: "Google Privacy Policy",
          href: "https://policies.google.com/privacy",
          external: true,
        },
      ],
    },
    {
      heading: "3. Per-App Privacy Disclosures",
      paragraphs: [
        "Every application or game published by KDILGAMES Software Studios has its own dedicated overview and Google Play-ready privacy policy page detailing package ID, local storage, optional purchases, and permissions.",
      ],
      links: STUDIO_APPS.map((app) => ({
        label: `${app.name} Privacy Policy`,
        href: `/studios/${app.slug}/privacy`,
      })),
    },
    {
      heading: "4. Contact & Privacy Requests",
      paragraphs: [
        `For privacy inquiries, Google Play Data Safety verification questions, or deletion requests regarding any online studio service, contact KDILGAMES Software Studios at ${DEFAULT_OWNER_EMAIL} or via our Discord server.`,
      ],
      links: [
        {
          label: `Email ${DEFAULT_OWNER_EMAIL}`,
          href: `mailto:${DEFAULT_OWNER_EMAIL}`,
          external: true,
        },
        {
          label: "Join KDILGAMES Discord",
          href: env.marketplace.discordUrl ?? "https://discord.gg/kdilgames",
          external: true,
        },
      ],
    },
  ],
};

export function listStudioApps(): StudioApp[] {
  return STUDIO_APPS;
}

export function getStudioAppBySlug(slug: string): StudioApp | undefined {
  return STUDIO_APPS.find((app) => app.slug === slug);
}
