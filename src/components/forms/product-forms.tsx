"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

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
  categories: Array<{ id: string; name: string }>;
  defaults: ProductFormDefaults;
  submitLabel?: string;
  productId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

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
          <Select id="categoryId" name="categoryId" defaultValue={defaults.categoryId} required>
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
        <Field label="Price" htmlFor="price" error={state.fieldErrors?.price}>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={defaults.price}
            placeholder="19.99"
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

      <Field
        label="Tags"
        htmlFor="tags"
        error={state.fieldErrors?.tags}
        hint="Comma separated, up to 12. Used by search."
      >
        <Input id="tags" name="tags" defaultValue={defaults.tags} maxLength={300} />
      </Field>

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
