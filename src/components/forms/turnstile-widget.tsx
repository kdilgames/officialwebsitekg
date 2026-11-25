"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          action?: string;
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-api-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Renders a Cloudflare Turnstile widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * is configured. Renders nothing when the key is absent (graceful fallback).
 */
export function TurnstileWidget({ action }: { action?: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const id = useId();

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;
      const theme =
        document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        action,
        size: "flexible",
      });
    };

    if (window.turnstile) {
      mountWidget();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", mountWidget);
      return () => {
        cancelled = true;
        script?.removeEventListener("load", mountWidget);
        if (widgetIdRef.current && window.turnstile?.remove) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action]);

  if (!siteKey) return null;

  return (
    <div className="pt-1" data-turnstile-wrapper={id}>
      <div ref={containerRef} />
    </div>
  );
}
