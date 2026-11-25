import type { Locale } from "./config";

export type Dictionary = {
  nav: {
    browse: string;
    newest: string;
    bestSelling: string;
    sellers: string;
    games: string;
    blog: string;
    help: string;
    studios: string;
    searchPlaceholder: string;
    cart: string;
    signIn: string;
    register: string;
  };
  footer: {
    marketplace: string;
    creators: string;
    support: string;
    studios: string;
    legal: string;
    tagline: string;
    operatedIn: string;
    cookiePrefs: string;
    rightsReserved: string;
  };
  ourGames: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    pressKit: string;
    allGames: string;
    exploreGame: string;
  };
  newsletter: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    placeholder: string;
    submit: string;
    submitting: string;
    consentNote: string;
  };
  blog: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    readArticle: string;
    minRead: string;
    backToBlog: string;
    morePosts: string;
  };
};

const EN: Dictionary = {
  nav: {
    browse: "Browse",
    newest: "Newest",
    bestSelling: "Best selling",
    sellers: "Sellers",
    games: "Games",
    blog: "Blog",
    help: "Help",
    studios: "Software Studios",
    searchPlaceholder: "Quick search...",
    cart: "Cart",
    signIn: "Sign in",
    register: "Create account",
  },
  footer: {
    marketplace: "Marketplace",
    creators: "Creators",
    support: "Support",
    studios: "Software Studios",
    legal: "Legal",
    tagline:
      "A curated digital marketplace for game developers and server owners — Roblox systems, Minecraft plugins, Discord bots, web templates and developer tools.",
    operatedIn: "Operated in Croatia (EU) · Secure payments via Stripe",
    cookiePrefs: "Cookie preferences",
    rightsReserved: "All rights reserved.",
  },
  ourGames: {
    eyebrow: "Original Titles",
    heading: "Our Games",
    subtitle:
      "Games developed in-house by KDILGAMES Software Studios — built offline-first with zero forced ads.",
    pressKit: "Press kit",
    allGames: "All games",
    exploreGame: "Explore game",
  },
  newsletter: {
    eyebrow: "Studio Dispatch",
    heading: "Get game launches, devlogs & creator drops",
    subtitle:
      "Occasional updates on ByteRack Tycoon, upcoming KDILGAMES titles, and standout free resources. Zero spam — one-click GDPR unsubscribe in every email.",
    placeholder: "you@studio.com",
    submit: "Subscribe",
    submitting: "Subscribing…",
    consentNote: "By subscribing you agree to receive studio updates per our Privacy Policy.",
  },
  blog: {
    eyebrow: "Engineering & Studio Notes",
    heading: "KDILGAMES Blog",
    subtitle:
      "Devlogs from ByteRack Tycoon, marketplace engineering insights, and practical guides for indie game creators.",
    readArticle: "Read article",
    minRead: "min read",
    backToBlog: "Back to blog",
    morePosts: "More from the blog",
  },
};

const HR: Dictionary = {
  nav: {
    browse: "Pregledaj",
    newest: "Najnovije",
    bestSelling: "Najprodavanije",
    sellers: "Prodavači",
    games: "Igre",
    blog: "Blog",
    help: "Pomoć",
    studios: "Software Studios",
    searchPlaceholder: "Brza pretraga...",
    cart: "Košarica",
    signIn: "Prijava",
    register: "Registracija",
  },
  footer: {
    marketplace: "Marketplace",
    creators: "Kreatori",
    support: "Podrška",
    studios: "Software Studios",
    legal: "Pravno",
    tagline:
      "Kurirani digitalni marketplace za game developere i vlasnike servera — Roblox sustavi, Minecraft plugini, Discord botovi, web predlošci i alati.",
    operatedIn: "Posluje u Hrvatskoj (EU) · Sigurno plaćanje putem Stripea",
    cookiePrefs: "Postavke kolačića",
    rightsReserved: "Sva prava pridržana.",
  },
  ourGames: {
    eyebrow: "Naši naslovi",
    heading: "Naše igre",
    subtitle:
      "Igre koje razvijamo unutar KDILGAMES Software Studios — offline-first dizajn bez prisilnih oglasa.",
    pressKit: "Press kit",
    allGames: "Sve igre",
    exploreGame: "Pogledaj igru",
  },
  newsletter: {
    eyebrow: "Novosti iz studija",
    heading: "Prati izlaske igara, devlogove i nove resurse",
    subtitle:
      "Povremene obavijesti o igri ByteRack Tycoon, novim KDILGAMES naslovima i besplatnim resursima. Bez spama — GDPR odjava jednim klikom.",
    placeholder: "ime@studio.hr",
    submit: "Pretplati se",
    submitting: "Slanje…",
    consentNote: "Pretplatom prihvaćate primanje obavijesti sukladno Politici privatnosti.",
  },
  blog: {
    eyebrow: "Devlogovi i vodiči",
    heading: "KDILGAMES Blog",
    subtitle:
      "Devlogovi za ByteRack Tycoon, tehničke bilješke s marketplacea i praktični vodiči za indie kreatore.",
    readArticle: "Pročitaj članak",
    minRead: "min čitanja",
    backToBlog: "Natrag na blog",
    morePosts: "Još s bloga",
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en: EN, hr: HR };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? EN;
}
