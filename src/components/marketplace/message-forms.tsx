"use client";

import { useActionState, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function MessageSellerForm({
  action,
  sellerId,
  sellerName,
  productId,
  defaultSubject,
}: {
  action: FormAction;
  sellerId: string;
  sellerName: string;
  productId?: string;
  defaultSubject?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <details className="surface-elevated p-3">
      <summary className="flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-ink hover:text-accent">
        <MessageSquare className="size-3.5 text-accent" aria-hidden />
        Message {sellerName}
      </summary>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="sellerId" value={sellerId} />
        {productId ? <input type="hidden" name="productId" value={productId} /> : null}

        {state.status !== "idle" && state.message ? (
          <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
        ) : null}

        <Field label="Subject" htmlFor={`dm-subject-${sellerId}`} error={state.fieldErrors?.subject}>
          <Input
            id={`dm-subject-${sellerId}`}
            name="subject"
            required
            maxLength={120}
            defaultValue={defaultSubject ?? ""}
            placeholder="Pre-sale or support question"
          />
        </Field>

        <Field label="Message" htmlFor={`dm-body-${sellerId}`} error={state.fieldErrors?.body}>
          <Textarea
            id={`dm-body-${sellerId}`}
            name="body"
            rows={3}
            required
            maxLength={3000}
            placeholder="Ask the creator about compatibility, licensing, or setup…"
          />
        </Field>

        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          <Send className="size-3.5" aria-hidden />
          {pending ? "Sending…" : "Send message"}
        </Button>
      </form>
    </details>
  );
}

export function MessageReplyForm({
  action,
  conversationId,
}: {
  action: FormAction;
  conversationId: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await action(prev, fd);
    if (res.status === "success") {
      formRef.current?.reset();
    }
    return res;
  }, idleState);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <Field label="Reply" htmlFor={`reply-${conversationId}`} error={state.fieldErrors?.body}>
        <Textarea
          id={`reply-${conversationId}`}
          name="body"
          rows={3}
          required
          maxLength={3000}
          placeholder="Write your reply…"
        />
      </Field>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        <Send className="size-3.5" aria-hidden />
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}
