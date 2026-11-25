import type { Locale } from "../i18n/config";

export type BlogPostSection = {
  heading: string;
  paragraphs: string[];
};

export type LocalizedPostContent = {
  title: string;
  excerpt: string;
  sections: BlogPostSection[];
};

export type BlogPost = {
  slug: string;
  publishedAt: string;
  readingMinutes: number;
  author: string;
  category: string;
  tags: string[];
  locales: Record<Locale, LocalizedPostContent>;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "byterack-tycoon-v1-6-devlog",
    publishedAt: "2026-11-18",
    readingMinutes: 4,
    author: "KDILGAMES Software Studios",
    category: "Devlog",
    tags: ["ByteRack Tycoon", "Mobile", "Android", "Simulation"],
    locales: {
      en: {
        title: "Inside ByteRack Tycoon v1.6: 3D Crises, Mega-Projects & Weekly Sprints",
        excerpt:
          "How we designed an offline-first server hosting tycoon with zero forced ads, live 3D warehouse incidents, and fair Weekly Sprint leaderboards.",
        sections: [
          {
            heading: "Why we built an offline-first tycoon",
            paragraphs: [
              "Most mobile idle games lock core progress behind aggressive interstitial video ads or always-online timers. With ByteRack Tycoon, we wanted the exact opposite: a deep server-hosting simulation that plays smoothly on a plane, respects battery life, and never interrupts gameplay with third-party ad networks.",
              "Every facility upgrade — from your starting bedroom rack up to the 2,600-bay Arctic Vault and multi-region Holding Ascensions — persists directly on your device.",
            ],
          },
          {
            heading: "Live 3D corridor crises & Mega-Projects",
            paragraphs: [
              "Version 1.6 brings active risk-reward decisions into the 3D data center aisle. Pushing power modes into Overdrive multiplies throughput on client SLA contracts, while increasing breaker-trip pressure, Sparking Racks, and incoming DDoS Packet Waves you intercept directly in the corridor.",
              "Long-term players can invest earnings into 5-stage Mega-Projects like Subsea Fiber, Fusion Core, and Orbital Uplink to unlock permanent multipliers across holding regions.",
            ],
          },
          {
            heading: "Privacy-first Global & Weekly Leaderboards",
            paragraphs: [
              "Our optional Global Leaderboard and Weekly Sprint Ladder sync only your chosen company name and game metrics to kdilgames.com using a randomly generated anonymous player key — no email, no account wall, and one-tap opt-out & deletion straight from the Ranks tab.",
            ],
          },
        ],
      },
      hr: {
        title: "ByteRack Tycoon v1.6 Devlog: 3D krize, Mega-Projekti i tjedni sprintovi",
        excerpt:
          "Kako smo osmislili offline-first simulaciju podatkovnih centara bez prisilnih oglasa, s 3D incidentima uživo i poštenim tjednim ljestvicama.",
        sections: [
          {
            heading: "Zašto offline-first tycoon bez prisilnih oglasa",
            paragraphs: [
              "Većina mobilnih idle igara koči napredak agresivnim video oglasima i stalnom potrebom za internetom. S igrom ByteRack Tycoon krenuli smo suprotnim putem: duboka simulacija hosting tvrtke koja radi glatko bez mreže i ne koristi vanjske oglasne SDK-ove.",
              "Svaka nadogradnja — od prvog racka u sobi do Arctic Vaulta s 2.600 servera i globalnih regija — sigurno se sprema lokalno na uređaju.",
            ],
          },
          {
            heading: "3D krize u hodniku i Mega-Projekti",
            paragraphs: [
              "Verzija 1.6 donosi dinamične odluke rizika i nagrade u 3D hodniku podatkovnog centra. Overdrive način rada ubrzava SLA ugovore, ali donosi iskrenje rackova, opterećenje osigurača i DDoS valove koje zaustavljate izravno u prikazu.",
              "Iskusni igrači mogu ulagati u peterostupanjske Mega-Projekte (Subsea Fiber, Fusion Core, Orbital Uplink) za trajne množitelje kroz sve regije.",
            ],
          },
          {
            heading: "Globalne i tjedne ljestvice uz punu privatnost",
            paragraphs: [
              "Opcionalne Global i Weekly Sprint ljestvice sinkroniziraju samo odabrani naziv tvrtke i rezultat igre putem nasumičnog anonimnog ključa — bez registracije i s brisanjem jednim klikom unutar igre.",
            ],
          },
        ],
      },
    },
  },
  {
    slug: "eu-vat-stripe-tax-for-indie-creators",
    publishedAt: "2026-11-22",
    readingMinutes: 5,
    author: "KDILGAMES Engineering",
    category: "Marketplace",
    tags: ["EU VAT", "Stripe Tax", "License Keys", "Creators"],
    locales: {
      en: {
        title: "EU VAT, Stripe Tax & Automated License Keys for Digital Creators",
        excerpt:
          "What independent Roblox, Minecraft, and web developers need to know about selling digital downloads compliantly across Europe.",
        sections: [
          {
            heading: "Handling EU VAT without manual spreadsheets",
            paragraphs: [
              "Under EU digital services rules, VAT depends on the buyer's member state — ranging from 17% in Luxembourg to 25% in Croatia and 27% in Hungary — while verified B2B EU VAT IDs qualify for reverse charge.",
              "KDILGAMES integrates Stripe Tax automatic VAT calculation and EU VAT ID collection directly into Checkout, recording collected tax and billing countries cleanly on every order.",
            ],
          },
          {
            heading: "Automated software license keys",
            paragraphs: [
              "Every completed purchase automatically mints a unique KDIL-XXXX-XXXX-XXXX-XXXX license key delivered both on the buyer's Orders page and in their Resend email receipt.",
              "Creators can validate and track activations in their plugins, Discord bots, or desktop tools using our public POST /api/licenses/verify endpoint, and revoke keys directly from the seller dashboard if a chargeback occurs.",
            ],
          },
        ],
      },
      hr: {
        title: "EU PDV, Stripe Tax i automatski licencni ključevi za digitalne kreatore",
        excerpt:
          "Što neovisni Roblox, Minecraft i web developeri trebaju znati o usklađenoj prodaji digitalnih proizvoda diljem Europske unije.",
        sections: [
          {
            heading: "Automatski obračun EU PDV-a bez ručnih tablica",
            paragraphs: [
              "Prema EU pravilima za elektroničke usluge, stopa PDV-a ovisi o državi kupca (npr. 25% u Hrvatskoj, 19% u Njemačkoj), dok poslovni kupci s valjanim EU PDV brojem ostvaruju prijenos porezne obveze.",
              "KDILGAMES integrira Stripe Tax za automatski izračun PDV-a i prikupljanje VAT ID-a izravno na naplati, uz jasno spremanje poreznih podataka na svakoj narudžbi.",
            ],
          },
          {
            heading: "Automatski licencni ključevi",
            paragraphs: [
              "Svaka dovršena narudžba automatski generira jedinstveni KDIL-XXXX-XXXX-XXXX-XXXX licencni ključ koji je odmah vidljiv na stranici narudžbi i u potvrdi e-poštom.",
              "Kreatori mogu provjeravati valjanost licenci u svojim pluginima i alatima putem javnog API-ja POST /api/licenses/verify te po potrebi opozvati ključ iz nadzorne ploče.",
            ],
          },
        ],
      },
    },
  },
  {
    slug: "launching-on-kdilgames-marketplace",
    publishedAt: "2026-11-25",
    readingMinutes: 4,
    author: "KDILGAMES Team",
    category: "Creator Guide",
    tags: ["Marketplace", "Creators", "Flash Sales", "Affiliates"],
    locales: {
      en: {
        title: "Launching Your First Resource on KDILGAMES: A Creator Checklist",
        excerpt:
          "How to structure live demos, flash sales, bundles, and direct buyer messaging to maximize conversions on KDILGAMES.",
        sections: [
          {
            heading: "Build trust before the click",
            paragraphs: [
              "Listings with clean screenshots, a live demo URL, clear compatibility tags, and transparent version changelogs convert dramatically higher than bare archives.",
              "As your store grows, KDILGAMES automatically awards verified creator badges — such as Top Seller, Top Rated, and Active Updates — derived strictly from settled orders, verified reviews, and recent releases.",
            ],
          },
          {
            heading: "Grow sales with flash sales, bundles & affiliates",
            paragraphs: [
              "Schedule limited-time flash sales with automatic countdown timers and automatic price reversion, package complementary assets into discounted bundles, and invite YouTubers or community leads to share /r/CODE affiliate links with 30-day attribution.",
            ],
          },
        ],
      },
      hr: {
        title: "Kako uspješno objaviti prvi proizvod na KDILGAMES marketplaceu",
        excerpt:
          "Praktičan vodič za demo linkove, flash akcije, pakete (bundles) i izravne poruke s kupcima.",
        sections: [
          {
            heading: "Izgradite povjerenje prije kupnje",
            paragraphs: [
              "Proizvodi s kvalitetnim snimkama zaslona, live demo linkom, oznakama kompatibilnosti i jasnim popisom izmjena ostvaruju znatno veću konverziju.",
              "Kako vaša trgovina raste, sustav automatski dodjeljuje provjerene bedževe kreatora (Top Seller, Top Rated, Active Updates) temeljene isključivo na stvarnim narudžbama i recenzijama.",
            ],
          },
          {
            heading: "Povećajte prodaju uz flash akcije, pakete i affiliate program",
            paragraphs: [
              "Postavite vremenski ograničene flash akcije s odbrojavanjem, povežite proizvode u pakete s popustom te uključite zajednicu putem /r/CODE affiliate linkova s 30-dnevnim praćenjem preporuka.",
            ],
          },
        ],
      },
    },
  },
];

export function listBlogPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getLocalizedBlogPost(post: BlogPost, locale: Locale): BlogPost & LocalizedPostContent {
  const localized = post.locales[locale] ?? post.locales.en;
  return {
    ...post,
    ...localized,
  };
}
