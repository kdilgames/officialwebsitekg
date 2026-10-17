/** URL-safe slug. Keeps unicode letters out on purpose so slugs stay portable. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function randomSuffix(length = 6): string {
  return Math.random().toString(36).slice(2, 2 + length);
}
