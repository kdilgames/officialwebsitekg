export type ProductTabKey = "overview" | "updates" | "reviews" | "qa";

export function normalizeProductTab(raw: string | undefined): ProductTabKey {
  if (raw === "updates" || raw === "reviews" || raw === "qa") return raw;
  return "overview";
}
