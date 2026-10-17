"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}

export function NewTicketForm({
  action,
  orders,
  defaultOrderId,
}: {
  action: FormAction;
  /** The buyer's recent paid orders, so a ticket can be tied to one of them. */
  orders: Array<{ id: string; label: string }>;
  defaultOrderId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3.5">
      <Message state={state} />

      <Field label="Subject" htmlFor="subject" error={state.fieldErrors?.subject}>
        <Input
          id="subject"
          name="subject"
          maxLength={140}
          required
          placeholder="Download link returns an error"
        />
      </Field>

      {orders.length > 0 ? (
        <Field
          label="Related order (optional)"
          htmlFor="orderId"
          error={state.fieldErrors?.orderId}
          hint="Attaching the order lets staff see the purchase without asking for it."
        >
          <Select id="orderId" name="orderId" defaultValue={defaultOrderId ?? ""}>
            <option value="">No specific order</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field
        label="Priority"
        htmlFor="priority"
        error={state.fieldErrors?.priority}
        hint="Use high or urgent only when the problem blocks your work."
      >
        <Select id="priority" name="priority" defaultValue="NORMAL">
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </Select>
      </Field>

      <Field
        label="What happened?"
        htmlFor="body"
        error={state.fieldErrors?.body}
        hint="Include what you expected, what happened instead, and any error message."
      >
        <Textarea id="body" name="body" rows={7} maxLength={4000} required />
      </Field>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/support" className="text-[12.5px] text-ink-muted hover:text-ink">
          Back to help centre
        </Link>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Opening ticket…" : "Open ticket"}
        </Button>
      </div>

      <p className="subtle text-[11.5px] leading-relaxed">
        Support is staffed by the platform team. Disputes about a product are usually resolved
        faster by posting in the ticket thread than by contacting your card issuer.
      </p>
    </form>
  );
}

export function TicketReplyForm({ action, ticketId }: { action: FormAction; ticketId: string }) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Message state={state} />

      <Field label="Add a reply" htmlFor={`reply-${ticketId}`} error={state.fieldErrors?.body}>
        <Textarea
          id={`reply-${ticketId}`}
          name="body"
          rows={4}
          maxLength={4000}
          required
          placeholder="Add any detail that helps staff reproduce the problem."
        />
      </Field>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}
