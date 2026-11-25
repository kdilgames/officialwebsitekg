"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  status: string;
  created_at?: string;
};

type EnrollmentState = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function MfaManager({ supabaseConfigured }: { supabaseConfigured: boolean }) {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );

  const refreshFactors = async () => {
    if (!supabaseConfigured) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setFeedback({ tone: "error", message: error.message });
      } else {
        setFactors((data?.totp ?? []) as TotpFactor[]);
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not load 2FA status.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (!active) return;
        if (error) {
          setFeedback({ tone: "error", message: error.message });
        } else {
          setFactors((data?.totp ?? []) as TotpFactor[]);
        }
      } catch (error) {
        if (!active) return;
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Could not load 2FA status.",
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [supabaseConfigured]);

  if (!supabaseConfigured) {
    return (
      <Alert tone="info" title="Supabase Auth required for 2FA">
        Two-factor authentication uses Supabase Auth MFA (TOTP). Configure Supabase environment
        variables to enable authenticator apps on this deployment.
      </Alert>
    );
  }

  const startEnrollment = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (error || !data) {
        setFeedback({ tone: "error", message: error?.message ?? "Could not start 2FA setup." });
        return;
      }
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } finally {
      setBusy(false);
    }
  };

  const verifyEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setFeedback(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
      if (challenge.error || !challenge.data) {
        setFeedback({
          tone: "error",
          message: challenge.error?.message ?? "Failed to create MFA challenge.",
        });
        return;
      }
      const verified = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verified.error) {
        setFeedback({ tone: "error", message: verified.error.message });
        return;
      }
      setEnrollment(null);
      setCode("");
      setFeedback({ tone: "success", message: "Two-factor authentication is now enabled." });
      await refreshFactors();
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (factorId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        setFeedback({ tone: "error", message: error.message });
        return;
      }
      setFeedback({ tone: "success", message: "Authenticator factor removed." });
      await refreshFactors();
    } finally {
      setBusy(false);
    }
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");

  return (
    <div className="space-y-4">
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-accent" aria-hidden />
          <span className="text-[13.5px] font-medium text-ink">Authenticator App (TOTP)</span>
          <Badge tone={verifiedFactors.length > 0 ? "positive" : "neutral"}>
            {loading ? "Checking…" : verifiedFactors.length > 0 ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        {!enrollment && verifiedFactors.length === 0 ? (
          <Button type="button" size="sm" variant="primary" disabled={busy || loading} onClick={startEnrollment}>
            <KeyRound className="size-3.5" aria-hidden />
            Enable 2FA
          </Button>
        ) : null}
      </div>

      {verifiedFactors.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-elevated">
          {verifiedFactors.map((factor) => (
            <li key={factor.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
              <div>
                <p className="font-medium text-ink">{factor.friendly_name || "Authenticator app"}</p>
                {factor.created_at ? (
                  <p className="subtle text-[11.5px]">Added {factor.created_at.slice(0, 10)}</p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => removeFactor(factor.id)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Disable
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {enrollment ? (
        <form onSubmit={verifyEnrollment} className="space-y-4 rounded-lg border border-line bg-elevated p-4">
          <p className="text-[13px] font-medium text-ink">
            1. Scan this QR code with Google Authenticator, 1Password, Authy, or Apple Passwords:
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline data URI returned by Supabase MFA */}
            <img
              src={enrollment.qrCode}
              alt="2FA TOTP QR code"
              className="size-40 rounded-lg border border-line bg-white p-2"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="subtle text-[11.5px]">Or enter this secret key manually:</p>
              <code className="block break-all rounded border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] text-ink">
                {enrollment.secret}
              </code>
            </div>
          </div>

          <Field label="2. Enter the 6-digit code from your app" htmlFor="totp-code">
            <Input
              id="totp-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="123456"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={busy}>
              {busy ? "Verifying…" : "Verify & enable 2FA"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setEnrollment(null);
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
