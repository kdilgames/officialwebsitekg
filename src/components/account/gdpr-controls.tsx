"use client";

import { useActionState } from "react";
import { Download, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function GdprExportCard() {
  return (
    <div className="space-y-3">
      <p className="muted text-[13px] leading-relaxed">
        Download a machine-readable JSON copy of your profile, seller details, purchase history,
        reviews, wishlist, followed creators, Q&amp;A, and support tickets (GDPR Art. 20).
      </p>
      <a href="/api/account/export" download className={buttonClass("secondary")}>
        <Download className="size-4" aria-hidden />
        Export my data (JSON)
      </a>
    </div>
  );
}

export function DeleteAccountForm({
  action,
  email,
  isOwnerAccount,
}: {
  action: FormAction;
  email: string;
  isOwnerAccount: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  if (isOwnerAccount) {
    return (
      <Alert tone="info">
        The primary platform owner account cannot be self-deleted. Transfer platform ownership
        before requesting erasure.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3.5">
      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
      ) : null}

      <p className="muted text-[13px] leading-relaxed">
        Deleting your account permanently removes your profile details, wishlist, follows, cart,
        and notifications, and archives any published store listings. Anonymized invoice records
        are retained where required by EU tax and accounting law (GDPR Art. 17(3)(b)).
      </p>

      <Field
        label={`Confirm your email (${email})`}
        htmlFor="confirmEmail"
        error={state.fieldErrors?.confirmEmail}
      >
        <Input
          id="confirmEmail"
          name="confirmEmail"
          type="email"
          required
          placeholder={email}
          autoComplete="off"
        />
      </Field>

      <Field
        label='Type "DELETE" to permanently erase your account'
        htmlFor="confirmPhrase"
        error={state.fieldErrors?.confirmPhrase}
      >
        <Input
          id="confirmPhrase"
          name="confirmPhrase"
          required
          placeholder="DELETE"
          autoComplete="off"
        />
      </Field>

      <Button type="submit" variant="danger" disabled={pending}>
        <Trash2 className="size-4" aria-hidden />
        {pending ? "Deleting account…" : "Permanently delete my account"}
      </Button>
    </form>
  );
}
