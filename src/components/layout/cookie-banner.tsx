"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Cookie, Settings2, X } from "lucide-react";

export type CookieConsent = {
  v: 1;
  essential: true;
  preferences: boolean;
  analytics: boolean;
  updatedAt: string;
};

const STORAGE_KEY = "kdil-cookie-consent";
const COOKIE_NAME = "kdil-consent";
const OPEN_EVENT = "kdil:open-cookie-banner";
const CHANGE_EVENT = "kdil:cookie-consent-changed";

function readStoredConsentRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (
      parsed.v === 1 &&
      typeof parsed.analytics === "boolean" &&
      typeof parsed.preferences === "boolean"
    ) {
      return {
        v: 1,
        essential: true,
        preferences: parsed.preferences,
        analytics: parsed.analytics,
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function persistConsent(consent: CookieConsent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Ignore storage quota / private mode failures.
  }
  const encoded = `v1:essential=1,preferences=${consent.preferences ? 1 : 0},analytics=${consent.analytics ? 1 : 0}`;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(encoded)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribeConsent(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function CookieBanner() {
  // Server returns "pending" so the banner does not render during SSR / hydration;
  // on the client it reads localStorage synchronously via useSyncExternalStore.
  const storedRaw = useSyncExternalStore(
    subscribeConsent,
    () => readStoredConsentRaw() ?? "unset",
    () => "pending",
  );

  const stored = storedRaw === "pending" || storedRaw === "unset" ? null : parseConsent(storedRaw);
  const [reopened, setReopened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [preferences, setPreferences] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const handleReopen = () => {
      const current = parseConsent(readStoredConsentRaw());
      if (current) {
        setPreferences(current.preferences);
        setAnalytics(current.analytics);
      }
      setExpanded(true);
      setReopened(true);
    };
    window.addEventListener(OPEN_EVENT, handleReopen);
    return () => window.removeEventListener(OPEN_EVENT, handleReopen);
  }, []);

  const visible = storedRaw !== "pending" && (!stored || reopened);
  if (!visible) return null;

  const save = (next: { preferences: boolean; analytics: boolean }) => {
    persistConsent({
      v: 1,
      essential: true,
      preferences: next.preferences,
      analytics: next.analytics,
      updatedAt: new Date().toISOString(),
    });
    setPreferences(next.preferences);
    setAnalytics(next.analytics);
    setReopened(false);
    setExpanded(false);
  };

  return (
    <aside
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-[560px] rounded-xl border border-line bg-surface p-4 shadow-lg sm:right-5 sm:left-auto"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Cookie className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">Privacy &amp; cookies (GDPR)</p>
            <p className="muted mt-1 text-[12px] leading-relaxed">
              We use strictly necessary cookies for sign-in sessions, cart state, and fraud
              protection. Optional cookies remember your preferences and help us improve the
              marketplace. Read our{" "}
              <Link href="/legal/cookies" className="text-accent hover:underline">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => save({ preferences: false, analytics: false })}
          aria-label="Dismiss with essential cookies only"
          className="rounded-md p-1 text-ink-muted hover:bg-elevated hover:text-ink"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2 rounded-lg border border-line bg-elevated p-3 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-ink">Strictly necessary</p>
              <p className="subtle text-[11.5px]">Authentication, security, cart, and checkout.</p>
            </div>
            <span className="text-[11px] font-semibold text-positive">Always on</span>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-line pt-2">
            <div>
              <p className="font-medium text-ink">Preferences</p>
              <p className="subtle text-[11.5px]">Theme and language preference cookies.</p>
            </div>
            <input
              type="checkbox"
              checked={preferences}
              onChange={(event) => setPreferences(event.target.checked)}
              className="size-4 accent-accent"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-line pt-2">
            <div>
              <p className="font-medium text-ink">Analytics</p>
              <p className="subtle text-[11.5px]">Privacy-friendly aggregate traffic measurement.</p>
            </div>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
              className="size-4 accent-accent"
            />
          </label>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="btn btn-ghost btn-sm mr-auto text-ink-muted"
        >
          <Settings2 className="size-3.5" aria-hidden />
          {expanded ? "Hide options" : "Customize"}
        </button>
        <button
          type="button"
          onClick={() => save({ preferences: false, analytics: false })}
          className="btn btn-secondary btn-sm"
        >
          Essential only
        </button>
        {expanded ? (
          <button
            type="button"
            onClick={() => save({ preferences, analytics })}
            className="btn btn-primary btn-sm"
          >
            Save choices
          </button>
        ) : (
          <button
            type="button"
            onClick={() => save({ preferences: true, analytics: true })}
            className="btn btn-primary btn-sm"
          >
            Accept all
          </button>
        )}
      </div>
    </aside>
  );
}

/** Footer trigger allowing users to reopen and change cookie consent at any time (GDPR Art. 7(3)). */
export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="text-left text-[13px] text-ink-muted transition-colors hover:text-ink"
    >
      Cookie preferences
    </button>
  );
}
