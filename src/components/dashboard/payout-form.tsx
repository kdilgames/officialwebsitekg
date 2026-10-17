"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/action-state";

export function PayoutRequestForm({
  action,
  disabled,
  disabledReason,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
      ) : null}

      {disabled && disabledReason ? <Alert tone="warning">{disabledReason}</Alert> : null}

      <Button type="submit" variant="primary" disabled={pending || disabled}>
        {pending ? "Requesting…" : "Request payout"}
      </Button>

      <p className="subtle text-[11.5px] leading-relaxed">
        A payout reserves your available balance and asks platform staff to release it. Funds are
        moved with a Stripe Transfer to your connected account, so the request is not a payment
        guarantee until Stripe confirms the transfer.
      </p>
    </form>
  );
}
