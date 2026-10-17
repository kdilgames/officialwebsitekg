"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}

export function ProfileForm({
  action,
  defaults,
}: {
  action: FormAction;
  defaults: {
    displayName: string;
    bio: string;
    country: string;
    marketingOptIn: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <Message state={state} />

      <Field label="Display name" htmlFor="displayName" error={state.fieldErrors?.displayName}>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={defaults.displayName}
          maxLength={60}
          required
        />
      </Field>

      <Field
        label="Country"
        htmlFor="country"
        error={state.fieldErrors?.country}
        hint="Two-letter ISO code, e.g. HR. Required on your invoices and for tax reporting."
      >
        <Input id="country" name="country" maxLength={2} defaultValue={defaults.country} placeholder="HR" />
      </Field>

      <Field label="Bio" htmlFor="bio" error={state.fieldErrors?.bio} hint="Optional, shown on your public profile.">
        <Textarea id="bio" name="bio" rows={4} maxLength={600} defaultValue={defaults.bio} />
      </Field>

      <label className="flex items-start gap-2 text-[12.5px] text-ink-muted">
        <input
          type="checkbox"
          name="marketingOptIn"
          value="true"
          defaultChecked={defaults.marketingOptIn}
          className="mt-0.5"
        />
        <span>Send me occasional product and platform updates. Optional.</span>
      </label>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function DeleteAccountForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Message state={state} />

      <p className="muted text-[12.5px] leading-relaxed">
        Closing your account revokes access immediately and clears your profile details. Order and
        payment records are retained because accounting and tax law require them. Type{" "}
        <span className="font-mono text-ink">DELETE</span> to confirm.
      </p>

      <Field label="Confirmation" htmlFor="confirmation" error={state.fieldErrors?.confirmation}>
        <Input id="confirmation" name="confirmation" autoComplete="off" placeholder="DELETE" required />
      </Field>

      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Closing account…" : "Close my account"}
      </Button>
    </form>
  );
}

export function SellerApplicationForm({
  action,
  defaults,
  submitLabel = "Submit application",
}: {
  action: FormAction;
  defaults: {
    storeName: string;
    slug: string;
    tagline: string;
    about: string;
    country: string;
    websiteUrl: string;
    supportEmail: string;
    applicationNote: string;
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <Message state={state} />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Store name" htmlFor="storeName" error={state.fieldErrors?.storeName}>
          <Input id="storeName" name="storeName" defaultValue={defaults.storeName} maxLength={60} required />
        </Field>
        <Field
          label="Store URL"
          htmlFor="slug"
          error={state.fieldErrors?.slug}
          hint="Lowercase letters, numbers and hyphens."
        >
          <Input id="slug" name="slug" defaultValue={defaults.slug} maxLength={48} required />
        </Field>
      </div>

      <Field label="Tagline" htmlFor="tagline" error={state.fieldErrors?.tagline} hint="Optional, one line.">
        <Input id="tagline" name="tagline" defaultValue={defaults.tagline} maxLength={140} />
      </Field>

      <Field
        label="About your work"
        htmlFor="about"
        error={state.fieldErrors?.about}
        hint="What you build, your experience, and what buyers can expect."
      >
        <Textarea id="about" name="about" rows={6} maxLength={4000} defaultValue={defaults.about} required />
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Country" htmlFor="country" error={state.fieldErrors?.country} hint="Two-letter ISO code.">
          <Input id="country" name="country" maxLength={2} defaultValue={defaults.country} placeholder="HR" />
        </Field>
        <Field label="Support email" htmlFor="supportEmail" error={state.fieldErrors?.supportEmail}>
          <Input
            id="supportEmail"
            name="supportEmail"
            type="email"
            defaultValue={defaults.supportEmail}
          />
        </Field>
      </div>

      <Field label="Website" htmlFor="websiteUrl" error={state.fieldErrors?.websiteUrl} hint="Optional.">
        <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={defaults.websiteUrl} placeholder="https://" />
      </Field>

      <Field
        label="Note for the review team"
        htmlFor="applicationNote"
        error={state.fieldErrors?.applicationNote}
        hint="Optional. Anything that helps us verify your work."
      >
        <Textarea
          id="applicationNote"
          name="applicationNote"
          rows={3}
          maxLength={2000}
          defaultValue={defaults.applicationNote}
        />
      </Field>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Submitting…" : submitLabel}
      </Button>
    </form>
  );
}
