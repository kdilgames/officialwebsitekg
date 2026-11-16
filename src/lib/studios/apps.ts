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
  termsOfService: {
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
    termsOfService: {
      effectiveDate: "November 16, 2026",
      lastUpdated: "November 16, 2026",
      version: "1.0",
      summary:
        "Terms of Service for ByteRack Tycoon (com.karlo.byterack), published by KDILGAMES Software Studios (Croatia, EU) for Google Play users and EU Digital Services Act compliance.",
      sections: [
        {
          heading: "1. Scope & Publisher Information",
          paragraphs: [
            'These Terms of Service govern your download, installation, and use of the mobile game ByteRack Tycoon (package ID com.karlo.byterack), developed and published by KDILGAMES Software Studios ("we", "our", or "us"), operated in Croatia (EU).',
            "By downloading or playing ByteRack Tycoon through Google Play, you also remain subject to the Google Play Terms of Service.",
          ],
          links: [
            {
              label: "ByteRack Tycoon Privacy Policy",
              href: "/studios/byterack-tycoon/privacy",
            },
          ],
        },
        {
          heading: "2. License & Permitted Use",
          paragraphs: [
            "We grant you a personal, non-exclusive, non-transferable, revocable license to download and play ByteRack Tycoon on compatible Android devices strictly for personal, non-commercial entertainment.",
          ],
          bullets: [
            "You may not redistribute, resell, decompile, or publish modified versions of the application package.",
            "You may not attempt to bypass, spoof, or manipulate Google Play Billing purchase verification.",
          ],
        },
        {
          heading: "3. Virtual In-Game Currency & Items",
          paragraphs: [
            "All virtual resources inside ByteRack Tycoon — including virtual cash, server tiers, Tech Tokens, upgrades, staff hires, and achievements — are simulated game progression elements only.",
            "Virtual items have no real-world monetary value, cannot be traded or redeemed for fiat currency or external goods, and exist solely within your local game state.",
          ],
        },
        {
          heading: "4. Optional In-App Purchases & EU Consumer Rights",
          paragraphs: [
            "ByteRack Tycoon is free to download and play offline. It offers an optional one-time in-app purchase (Founder Starter Pack, product ID byterack_starter_pack), processed directly through Google Play Billing.",
            "The exact price, currency, and applicable taxes (including VAT in EU Member States) are displayed inside the Google Play checkout sheet before you confirm payment.",
            "For users located in the European Economic Area (EEA) and United Kingdom: Google Play acts as the merchant payment processor and handles receipts, purchase restoration, and refund requests in accordance with Google Play refund policies and applicable EU/UK consumer protection law.",
          ],
          links: [
            {
              label: "Google Play Terms of Service",
              href: "https://play.google.com/about/play-terms/",
              external: true,
            },
          ],
        },
        {
          heading: "5. Offline Save Data & Updates",
          paragraphs: [
            "Gameplay progress is stored locally on your device via Android SharedPreferences (and optionally Android Auto Backup if enabled in your device settings). Uninstalling the game or clearing app data may permanently delete unsaved local progress.",
            "We may release periodic gameplay updates, bug fixes, or compatibility patches via Google Play.",
          ],
        },
        {
          heading: "6. Intellectual Property & External Links",
          paragraphs: [
            "All artwork, sprite assets, UI designs, code, audio effects, and KDILGAMES Software Studios branding remain the intellectual property of KDILGAMES.",
            "Optional community links inside the game (Website, Discord, TikTok, Instagram, X / Twitter) open third-party platforms governed by their respective terms.",
          ],
        },
        {
          heading: "7. Warranty, Liability & Contact",
          paragraphs: [
            "To the maximum extent permitted by applicable EU and Croatian law, ByteRack Tycoon is provided on an 'as is' and 'as available' basis without prejudice to mandatory statutory consumer rights that cannot be excluded by law.",
            `For support, refund assistance referrals, or EU consumer inquiries regarding ByteRack Tycoon, contact KDILGAMES Software Studios at ${DEFAULT_OWNER_EMAIL}.`,
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

export const STUDIO_GENERAL_TERMS: {
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
    "General Terms of Service for standalone mobile apps and games published by KDILGAMES Software Studios (Croatia, EU), separate from KDILGAMES Digital Marketplace listings.",
  sections: [
    {
      heading: "1. Applicability & Distinction from Marketplace",
      paragraphs: [
        "These Terms of Service apply to first-party mobile apps and games published under KDILGAMES Software Studios on Google Play and mobile app stores.",
        "Digital assets, scripts, and creator storefronts purchased on the web marketplace are governed by the separate Marketplace Terms of Service.",
      ],
      links: [
        {
          label: "Marketplace Terms of Service",
          href: "/legal/terms",
        },
      ],
    },
    {
      heading: "2. Store Billing & EU Consumer Rights",
      paragraphs: [
        "Any optional in-app purchases offered in KDILGAMES Software Studios apps are processed by Google Play Billing with transparent pricing displayed before checkout and in compliance with EU consumer protection rules.",
      ],
    },
    {
      heading: "3. Per-App Terms of Service",
      paragraphs: [
        "Select any individual studio release below to read its dedicated Terms of Service:",
      ],
      links: STUDIO_APPS.map((app) => ({
        label: `${app.name} Terms of Service`,
        href: `/studios/${app.slug}/terms`,
      })),
    },
    {
      heading: "4. Contact KDILGAMES Software Studios",
      paragraphs: [
        `Operated in Croatia (EU). Contact ${DEFAULT_OWNER_EMAIL} or reach us via Discord for support and legal inquiries.`,
      ],
      links: [
        {
          label: `Email ${DEFAULT_OWNER_EMAIL}`,
          href: `mailto:${DEFAULT_OWNER_EMAIL}`,
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
