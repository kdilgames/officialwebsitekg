"use client";

import { useActionState, useState } from "react";

import { getCompatibilityTagsForCategory } from "@/components/marketplace/category-filters";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils/cn";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}

const LICENSE_TYPES = [
  { value: "PERSONAL", label: "Personal" },
  { value: "STANDARD", label: "Standard" },
  { value: "EXTENDED", label: "Extended" },
  { value: "CUSTOM", label: "Custom" },
];

const CURRENCIES = ["EUR", "USD", "GBP"];

export type ProductFormDefaults = {
  title: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  price: string;
  salePrice: string;
  currency: string;
  licenseType: string;
  licenseText: string;
  demoUrl: string;
  videoUrl: string;
  version: string;
  tags: string;
  compatibility: string;
  requirements: string;
};

export function ProductForm({
  action,
  categories,
  defaults,
  submitLabel = "Save product",
  productId,
}: {
  action: FormAction;
  categories: Array<{ id: string; name: string; slug: string }>;
  defaults: ProductFormDefaults;
  submitLabel?: string;
  productId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaults.categoryId);
  const [tagsValue, setTagsValue] = useState(defaults.tags);

  const selectedCategory = categories.find((entry) => entry.id === selectedCategoryId);
  const suggestedTags = getCompatibilityTagsForCategory(selectedCategory?.slug);
  const activeTagSet = new Set(
    tagsValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );

  function toggleSuggestedTag(tag: string) {
    const normalized = tag.trim().toLowerCase();
    const list = tagsValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (list.includes(normalized)) {
      setTagsValue(list.filter((item) => item !== normalized).join(", "));
    } else if (list.length < 12) {
      setTagsValue([...list, normalized].join(", "));
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      <Message state={state} />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Title" htmlFor="title" error={state.fieldErrors?.title}>
          <Input id="title" name="title" defaultValue={defaults.title} maxLength={120} required />
        </Field>
        <Field
          label="Product URL"
          htmlFor="slug"
          error={state.fieldErrors?.slug}
          hint="Lowercase letters, numbers and hyphens."
        >
          <Input id="slug" name="slug" defaultValue={defaults.slug} maxLength={120} required />
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field label="Category" htmlFor="categoryId" error={state.fieldErrors?.categoryId}>
          <Select
            id="categoryId"
            name="categoryId"
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            required
          >
            <option value="">Choose a category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Version" htmlFor="version" error={state.fieldErrors?.version} hint="e.g. 1.0.0">
          <Input id="version" name="version" defaultValue={defaults.version} required maxLength={32} />
        </Field>
        <Field label="License" htmlFor="licenseType" error={state.fieldErrors?.licenseType}>
          <Select id="licenseType" name="licenseType" defaultValue={defaults.licenseType}>
            {LICENSE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Short summary"
        htmlFor="shortDescription"
        error={state.fieldErrors?.shortDescription}
        hint="One line shown on cards and search results."
      >
        <Input
          id="shortDescription"
          name="shortDescription"
          defaultValue={defaults.shortDescription}
          maxLength={240}
          required
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        error={state.fieldErrors?.description}
        hint="What it does, how it is configured, and anything buyers must know before purchase."
      >
        <Textarea
          id="description"
          name="description"
          rows={10}
          defaultValue={defaults.description}
          maxLength={20000}
          required
        />
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field
          label="Price"
          htmlFor="price"
          error={state.fieldErrors?.price}
          hint="Enter 0 for a free listing, or 0.50+ for paid."
        >
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={defaults.price}
            placeholder="0 or 19.99"
            required
          />
        </Field>
        <Field
          label="Sale price"
          htmlFor="salePrice"
          error={state.fieldErrors?.salePrice}
          hint="Optional, must be below the regular price."
        >
          <Input
            id="salePrice"
            name="salePrice"
            inputMode="decimal"
            defaultValue={defaults.salePrice}
            placeholder="Optional"
          />
        </Field>
        <Field label="Currency" htmlFor="currency" error={state.fieldErrors?.currency}>
          <Select id="currency" name="currency" defaultValue={defaults.currency}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-2">
        <Field
          label="Tags"
          htmlFor="tags"
          error={state.fieldErrors?.tags}
          hint="Comma separated, up to 12. Click suggestions below to add."
        >
          <Input
            id="tags"
            name="tags"
            value={tagsValue}
            onChange={(event) => setTagsValue(event.target.value)}
            maxLength={300}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="subtle text-[11.5px]">
            Suggested{selectedCategory ? ` for ${selectedCategory.name}` : ""}:
          </span>
          {suggestedTags.map((tag) => {
            const active = activeTagSet.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleSuggestedTag(tag)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors",
                  active
                    ? "border-accent bg-accent-quiet font-medium text-accent"
                    : "border-line bg-elevated text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {active ? `✓ ${tag}` : `+ ${tag}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label="Live demo URL"
          htmlFor="demoUrl"
          error={state.fieldErrors?.demoUrl}
          hint="Optional interactive sandbox, test site, or preview showcase."
        >
          <Input
            id="demoUrl"
            name="demoUrl"
            type="url"
            defaultValue={defaults.demoUrl}
            placeholder="https://demo.example.com"
          />
        </Field>
        <Field
          label="Video preview URL"
          htmlFor="videoUrl"
          error={state.fieldErrors?.videoUrl}
          hint="Optional YouTube or Vimeo link shown in the listing gallery."
        >
          <Input
            id="videoUrl"
            name="videoUrl"
            type="url"
            defaultValue={defaults.videoUrl}
            placeholder="https://youtube.com/watch?v=..."
          />
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label="Compatibility"
          htmlFor="compatibility"
          error={state.fieldErrors?.compatibility}
          hint="Versions of the engine or platform this supports."
        >
          <Textarea
            id="compatibility"
            name="compatibility"
            rows={3}
            defaultValue={defaults.compatibility}
            maxLength={2000}
          />
        </Field>
        <Field
          label="Requirements"
          htmlFor="requirements"
          error={state.fieldErrors?.requirements}
          hint="What the buyer needs before installing."
        >
          <Textarea
            id="requirements"
            name="requirements"
            rows={3}
            defaultValue={defaults.requirements}
            maxLength={2000}
          />
        </Field>
      </div>

      <Field
        label="License terms"
        htmlFor="licenseText"
        error={state.fieldErrors?.licenseText}
        hint="Optional. Leave blank to use the platform's standard license."
      >
        <Textarea
          id="licenseText"
          name="licenseText"
          rows={5}
          defaultValue={defaults.licenseText}
          maxLength={8000}
        />
      </Field>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

export function VersionForm({
  action,
  productId,
}: {
  action: FormAction;
  productId: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <input type="hidden" name="productId" value={productId} />
      <Message state={state} />

      <div className="grid gap-3.5 sm:grid-cols-[160px_1fr]">
        <Field label="Version" htmlFor="version" error={state.fieldErrors?.version}>
          <Input id="version" name="version" placeholder="1.1.0" required maxLength={32} />
        </Field>
        <Field label="Changelog" htmlFor="changelog" error={state.fieldErrors?.changelog}>
          <Textarea
            id="changelog"
            name="changelog"
            rows={3}
            placeholder="What changed for buyers who already own this product."
            required
          />
        </Field>
      </div>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Publishing…" : "Publish version"}
      </Button>
    </form>
  );
}
