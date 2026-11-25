import { getEffectivePriceMinor } from "../marketplace/flash-sale";

export type ProductJsonLdInput = {
  siteUrl: string;
  slug: string;
  title: string;
  shortDescription: string;
  imageUrls: string[];
  categoryName: string;
  sellerName: string;
  sellerSlug: string;
  priceMinor: number;
  salePriceMinor: number | null;
  saleEndsAt?: Date | null;
  currency: string;
  version: string;
  ratingSum: number;
  ratingCount: number;
};

/**
 * Builds a schema.org Product JSON-LD document for rich Google Shopping and
 * marketplace search snippets.
 */
export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const origin = input.siteUrl.replace(/\/+$/, "");
  const effectiveMinor = getEffectivePriceMinor({
    priceMinor: input.priceMinor,
    salePriceMinor: input.salePriceMinor,
    saleEndsAt: input.saleEndsAt,
  });
  const priceMajor = (effectiveMinor / 100).toFixed(2);
  const productUrl = `${origin}/product/${input.slug}`;

  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url: productUrl,
    priceCurrency: input.currency.toUpperCase(),
    price: priceMajor,
    availability: "https://schema.org/InStock",
    seller: {
      "@type": "Organization",
      name: input.sellerName,
      url: `${origin}/seller/${input.sellerSlug}`,
    },
  };

  if (input.saleEndsAt && input.salePriceMinor !== null && input.salePriceMinor < input.priceMinor) {
    offer.priceValidUntil = input.saleEndsAt.toISOString().slice(0, 10);
  }

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.title,
    description: input.shortDescription,
    sku: input.slug,
    category: input.categoryName,
    url: productUrl,
    brand: {
      "@type": "Brand",
      name: input.sellerName,
    },
    offers: offer,
  };

  if (input.imageUrls.length > 0) {
    schema.image = input.imageUrls;
  }

  if (input.ratingCount > 0) {
    const avg = Math.min(5, Math.max(1, input.ratingSum / input.ratingCount));
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(avg.toFixed(2)),
      reviewCount: input.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

export function buildGameJsonLd(input: {
  siteUrl: string;
  slug: string;
  name: string;
  description: string;
  imageUrl?: string;
  platform: string;
  genres?: string[];
  version: string;
}): Record<string, unknown> {
  const origin = input.siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: input.name,
    description: input.description,
    url: `${origin}/games/${input.slug}`,
    ...(input.imageUrl ? { image: input.imageUrl.startsWith("http") ? input.imageUrl : `${origin}${input.imageUrl}` } : {}),
    gamePlatform: input.platform,
    genre: input.genres ?? ["Simulation"],
    softwareVersion: input.version,
    author: {
      "@type": "Organization",
      name: "KDILGAMES Software Studios",
      url: origin,
    },
    offers: {
      "@type": "Offer",
      price: "0.00",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  };
}

export function buildBlogPostJsonLd(input: {
  siteUrl: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  author: string;
  tags: string[];
}): Record<string, unknown> {
  const origin = input.siteUrl.replace(/\/+$/, "");
  const url = `${origin}/blog/${input.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.excerpt,
    url,
    mainEntityOfPage: url,
    datePublished: input.publishedAt,
    dateModified: input.publishedAt,
    keywords: input.tags.join(", "),
    author: {
      "@type": "Organization",
      name: input.author,
      url: origin,
    },
    publisher: {
      "@type": "Organization",
      name: "KDILGAMES",
      url: origin,
    },
  };
}

/**
 * Serializes JSON-LD safely for embedding inside `<script type="application/ld+json">`,
 * escaping `<` characters to prevent premature `</script>` tag injection.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
