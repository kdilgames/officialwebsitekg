"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function RefundRequestForm({ action, orderId }: { action: FormAction; orderId: string }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <details>
      <summary className="cursor-pointer text-[12px] text-ink-muted hover:text-ink">
        Request a refund
      </summary>
      <div className="surface-elevated mt-3 space-y-3 p-3.5">
        <Alert tone="info">
          Requesting a refund files it for review — no money moves until platform staff decide the
          request and the payment provider confirms the reversal.
        </Alert>

        {state.status !== "idle" && state.message ? (
          <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
        ) : null}

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="orderId" value={orderId} />

          <Field
            label="Why are you requesting a refund?"
            htmlFor={`refund-reason-${orderId}`}
            error={state.fieldErrors?.reason}
            hint="Include what you expected and what the product actually did."
          >
            <Textarea
              id={`refund-reason-${orderId}`}
              name="reason"
              rows={4}
              minLength={10}
              maxLength={2000}
              required
            />
          </Field>

          <Button type="submit" variant="danger" size="sm" disabled={pending}>
            {pending ? "Submitting…" : "Submit refund request"}
          </Button>
        </form>
      </div>
    </details>
  );
}
