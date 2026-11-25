"use client";

import { useActionState } from "react";

import { TurnstileWidget } from "@/components/forms/turnstile-widget";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function DmcaNoticeForm({
  action,
  defaultProductUrl,
}: {
  action: FormAction;
  defaultProductUrl?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-4">
      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Your full name" htmlFor="claimantName" error={state.fieldErrors?.claimantName}>
          <Input id="claimantName" name="claimantName" required maxLength={120} />
        </Field>
        <Field label="Contact email" htmlFor="claimantEmail" error={state.fieldErrors?.claimantEmail}>
          <Input id="claimantEmail" name="claimantEmail" type="email" required maxLength={160} />
        </Field>
      </div>

      <Field
        label="Studio / Company / Rights holder (optional)"
        htmlFor="claimantCompany"
        error={state.fieldErrors?.claimantCompany}
      >
        <Input id="claimantCompany" name="claimantCompany" maxLength={140} />
      </Field>

      <Field
        label="URL of allegedly infringing listing on KDILGAMES"
        htmlFor="productUrl"
        error={state.fieldErrors?.productUrl}
      >
        <Input
          id="productUrl"
          name="productUrl"
          type="url"
          required
          defaultValue={defaultProductUrl ?? ""}
          placeholder="https://kdilgames.com/product/example-listing"
        />
      </Field>

      <Field
        label="URL to your original copyrighted work"
        htmlFor="originalWorkUrl"
        error={state.fieldErrors?.originalWorkUrl}
        hint="Link to your official storefront page, repository, or published asset."
      >
        <Input
          id="originalWorkUrl"
          name="originalWorkUrl"
          type="url"
          required
          placeholder="https://github.com/your-studio/original-work"
        />
      </Field>

      <Field
        label="Detailed description of the infringement"
        htmlFor="description"
        error={state.fieldErrors?.description}
        hint="Identify which files, code, artwork, or assets are copied and how ownership can be verified."
      >
        <Textarea id="description" name="description" rows={5} required minLength={30} maxLength={4000} />
      </Field>

      <fieldset className="space-y-2.5 rounded-lg border border-line bg-elevated p-3.5">
        <legend className="text-[12px] font-semibold text-ink">Legal declarations</legend>

        <label className="flex items-start gap-2 text-[12.5px] text-ink-muted">
          <input type="checkbox" name="goodFaithStatement" value="true" required className="mt-0.5" />
          <span>
            I have a good-faith belief that the disputed use of the material is not authorized by
            the copyright owner, its agent, or the law.
          </span>
        </label>

        <label className="flex items-start gap-2 text-[12.5px] text-ink-muted">
          <input type="checkbox" name="accuracyStatement" value="true" required className="mt-0.5" />
          <span>
            I declare under penalty of perjury that the information in this notice is accurate and
            that I am the copyright owner or authorized to act on the owner&apos;s behalf.
          </span>
        </label>
      </fieldset>

      <Field
        label="Electronic signature (type your full legal name)"
        htmlFor="signature"
        error={state.fieldErrors?.signature}
      >
        <Input id="signature" name="signature" required maxLength={120} placeholder="Full legal name" />
      </Field>

      <TurnstileWidget action="dmca_notice" />

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Submitting notice…" : "Submit DMCA / Copyright notice"}
      </Button>
    </form>
  );
}
