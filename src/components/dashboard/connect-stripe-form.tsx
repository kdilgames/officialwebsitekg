"use client";

import { useActionState, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  idleConnectState,
  idleState,
  type ActionState,
  type ConnectActionState,
} from "@/lib/action-state";

export function ConnectStripeControls({
  startAction,
  refreshAction,
  hasAccount,
  disabled,
}: {
  startAction: (state: ConnectActionState, formData: FormData) => Promise<ConnectActionState>;
  refreshAction: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hasAccount: boolean;
  disabled?: boolean;
}) {
  const [connectState, connectFormAction, connectPending] = useActionState(
    startAction,
    idleConnectState,
  );
  const [refreshState, refreshFormAction, refreshPending] = useActionState(
    refreshAction,
    idleState,
  );
  const [lastAction, setLastAction] = useState<"connect" | "refresh" | null>(null);

  useEffect(() => {
    if (connectState.status === "redirect" && connectState.url) {
      window.location.assign(connectState.url);
    }
  }, [connectState.status, connectState.url]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={connectFormAction} onSubmit={() => setLastAction("connect")}>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={connectPending || refreshPending || disabled}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {connectPending
              ? "Connecting to Stripe…"
              : hasAccount
                ? "Continue onboarding"
                : "Connect Stripe"}
          </Button>
        </form>

        {hasAccount ? (
          <form action={refreshFormAction} onSubmit={() => setLastAction("refresh")}>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={refreshPending || connectPending || disabled}
            >
              <RefreshCw
                className={`size-3.5 ${refreshPending ? "animate-spin" : ""}`}
                aria-hidden
              />
              {refreshPending ? "Checking Stripe…" : "Refresh status"}
            </Button>
          </form>
        ) : null}
      </div>

      {lastAction === "connect" && connectState.status === "error" && connectState.message ? (
        <Alert tone="error" title="Could not open Stripe onboarding">
          {connectState.message}
        </Alert>
      ) : null}

      {lastAction === "connect" && connectState.status === "redirect" && connectState.url ? (
        <Alert tone="info" title="Redirecting to Stripe…">
          Opening Stripe onboarding. If your browser does not redirect automatically,{" "}
          <a href={connectState.url} className="font-medium underline">
            continue to Stripe
          </a>
          .
        </Alert>
      ) : null}

      {lastAction === "refresh" &&
      refreshState.status !== "idle" &&
      refreshState.message ? (
        <Alert tone={refreshState.status === "error" ? "error" : "success"}>
          {refreshState.message}
        </Alert>
      ) : null}
    </div>
  );
}
