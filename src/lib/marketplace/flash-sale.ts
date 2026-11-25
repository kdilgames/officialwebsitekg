export type FlashSaleProductLike = {
  priceMinor: number;
  salePriceMinor: number | null;
  saleEndsAt?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Returns true if the product has an active discount right now.
 * If `saleEndsAt` is set and in the past, the flash sale has expired.
 */
export function isSaleActive(product: FlashSaleProductLike, now = new Date()): boolean {
  if (product.salePriceMinor === null || product.salePriceMinor >= product.priceMinor) {
    return false;
  }
  const endsAt = toDate(product.saleEndsAt);
  if (endsAt && endsAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** True when an active sale also has a scheduled countdown expiration. */
export function isFlashSaleActive(product: FlashSaleProductLike, now = new Date()): boolean {
  if (!isSaleActive(product, now)) return false;
  const endsAt = toDate(product.saleEndsAt);
  return endsAt !== null && endsAt.getTime() > now.getTime();
}

/** Returns the live effective price in minor units, ignoring expired flash sales. */
export function getEffectivePriceMinor(product: FlashSaleProductLike, now = new Date()): number {
  return isSaleActive(product, now) && product.salePriceMinor !== null
    ? product.salePriceMinor
    : product.priceMinor;
}

/** Formats remaining flash sale time into a compact human-readable label. */
export function formatFlashCountdown(endsAtInput: Date | string, now = new Date()): string | null {
  const endsAt = toDate(endsAtInput);
  if (!endsAt) return null;
  const diffMs = endsAt.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${Math.max(1, minutes)}m left`;
}
