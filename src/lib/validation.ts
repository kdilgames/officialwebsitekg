import { z } from "zod";

export const TERMS_VERSION = "2026-10-17";

const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(24, "Username must be at most 24 characters.")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only.");

const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "Password is too long.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

/**
 * A required consent checkbox.
 *
 * A ticked checkbox posts the string "true", so `z.literal(true)` rejected every
 * submission and made registration impossible. Anything other than an explicit
 * truthy value — including a missing field — fails with the supplied message.
 */
const consent = (message: string) =>
  z
    .unknown()
    .refine((value) => value === true || value === "true" || value === "on", { message })
    .transform(() => true as const);

export const registerSchema = z.object({
  username,
  displayName: z.string().trim().min(2, "Display name is too short.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password,
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "Use a two-letter country code.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  marketingOptIn: z.coerce.boolean().default(false),
  acceptTerms: consent("You must accept the Terms of Service."),
  acceptPrivacy: consent("You must accept the Privacy Policy."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const resetPasswordSchema = z.object({
  password,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export const accountProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Display name is too short.").max(60),
  bio: z.string().trim().max(600).optional().or(z.literal("").transform(() => undefined)),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "Use a two-letter country code.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  marketingOptIn: z.coerce.boolean().default(false),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const sellerApplicationSchema = z.object({
  storeName: z.string().trim().min(3, "Store name is too short.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
  tagline: z.string().trim().max(140).optional().or(z.literal("").transform(() => undefined)),
  about: z.string().trim().min(30, "Tell buyers a little more about your work.").max(4000),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "Use a two-letter country code.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  websiteUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  supportEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  applicationNote: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const sellerProfileSchema = sellerApplicationSchema.pick({
  storeName: true,
  slug: true,
  tagline: true,
  about: true,
  websiteUrl: true,
  supportEmail: true,
});

export const productSchema = z.object({
  title: z.string().trim().min(4, "Title is too short.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(4)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
  categoryId: z.string().uuid("Choose a category."),
  shortDescription: z.string().trim().min(20, "Add a short summary (20+ characters).").max(240),
  description: z.string().trim().min(60, "Describe the product in at least 60 characters.").max(20000),
  price: z.coerce.number().min(0.5, "Minimum price is 0.50.").max(100000),
  salePrice: z.coerce.number().min(0.5).max(100000).optional().nullable(),
  currency: z.string().trim().toUpperCase().length(3).default("EUR"),
  licenseType: z.enum(["PERSONAL", "STANDARD", "EXTENDED", "CUSTOM"]).default("STANDARD"),
  licenseText: z.string().trim().max(8000).optional().or(z.literal("").transform(() => undefined)),
  version: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[0-9A-Za-z.\-+]+$/, "Use a version like 1.0.0."),
  tags: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
        .slice(0, 12),
    ),
  compatibility: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
  requirements: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
});

export const reviewSchema = z.object({
  productId: z.string().uuid(),
  orderItemId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, "Pick a rating.").max(5),
  title: z.string().trim().max(120).optional().or(z.literal("").transform(() => undefined)),
  body: z.string().trim().min(10, "Write at least 10 characters.").max(4000),
});

export const sellerReplySchema = z.object({
  reviewId: z.string().uuid(),
  reply: z.string().trim().min(5, "Write at least 5 characters.").max(2000),
});

export const reportSchema = z.object({
  targetType: z.enum(["PRODUCT", "USER", "REVIEW"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3, "Pick a reason.").max(120),
  details: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
});

export const refundRequestSchema = z.object({
  orderId: z.string().uuid(),
  orderItemId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  reason: z.string().trim().min(10, "Explain the reason (10+ characters).").max(2000),
});

export const ticketSchema = z.object({
  subject: z.string().trim().min(5, "Add a subject.").max(140),
  orderId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  body: z.string().trim().min(10, "Describe your issue (10+ characters).").max(4000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export const ticketReplySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a message.").max(4000),
});

/**
 * A tri-state flag control.
 *
 * `z.coerce.boolean()` is unusable for these: `Boolean("false")` is `true`, and
 * an absent field falls through to the default, so an unchecked checkbox could
 * never turn a setting off. The admin interface therefore posts an explicit
 * "true"/"false" and this parser reads it literally.
 */
const booleanFlag = (fallback: boolean) =>
  z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(fallback);

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
  description: z.string().trim().max(400).optional().or(z.literal("").transform(() => undefined)),
  icon: z.string().trim().max(60).optional().or(z.literal("").transform(() => undefined)),
  parentId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: booleanFlag(true),
});

export const commissionRuleSchema = z.object({
  scope: z.enum(["GLOBAL", "CATEGORY", "SELLER", "PRODUCT"]),
  targetId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  ratePercent: z.coerce.number().min(0, "Cannot be negative.").max(90, "Cannot exceed 90%."),
  note: z.string().trim().max(300).optional().or(z.literal("").transform(() => undefined)),
  isActive: booleanFlag(true),
});

export const legalPageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(300).optional().or(z.literal("").transform(() => undefined)),
  body: z.string().trim().min(20).max(200000),
  version: z.string().trim().max(20).default("1.0"),
  isPublished: z.coerce.boolean().default(true),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type SellerApplicationInput = z.infer<typeof sellerApplicationSchema>;
