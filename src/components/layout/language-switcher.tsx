"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe } from "lucide-react";

import { LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(currentLocale);
  const [pending, setPending] = useState(false);

  const switchTo = async (nextLocale: Locale) => {
    if (nextLocale === locale || pending) return;
    setPending(true);
    setLocale(nextLocale);

    // Update cookie immediately client-side and via API for consistent SSR refresh.
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
    document.documentElement.lang = nextLocale;

    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
    } catch {
      // Client cookie is already updated.
    } finally {
      setPending(false);
      router.refresh();
    }
  };

  return (
    <div
      className="inline-flex items-center rounded-lg border border-line bg-elevated/70 p-0.5 text-[11.5px] font-medium"
      role="group"
      aria-label="Language"
    >
      <Globe className="mx-1.5 hidden size-3 text-ink-subtle sm:block" aria-hidden />
      <button
        type="button"
        onClick={() => switchTo("en")}
        disabled={pending}
        aria-pressed={locale === "en"}
        className={`rounded-md px-1.5 py-0.5 transition-colors ${
          locale === "en" ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo("hr")}
        disabled={pending}
        aria-pressed={locale === "hr"}
        className={`rounded-md px-1.5 py-0.5 transition-colors ${
          locale === "hr" ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink"
        }`}
      >
        HR
      </button>
    </div>
  );
}
