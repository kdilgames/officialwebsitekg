"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const STORAGE_KEY = "kdil-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage access restrictions (e.g. private browsing).
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const syncFromDom = () => {
      const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      setTheme(current);
    };

    syncFromDom();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next: Theme = event.newValue === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      setTheme(next);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const selectTheme = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex h-8 shrink-0 items-center rounded-[8px] border border-line bg-elevated/80 p-0.5"
    >
      <button
        type="button"
        onClick={() => selectTheme("light")}
        aria-label="Light mode"
        aria-pressed={theme !== null ? theme === "light" : undefined}
        title="Light mode"
        className="flex size-7 items-center justify-center rounded-[6px] bg-surface text-ink shadow-xs transition-colors dark:bg-transparent dark:text-ink-subtle dark:shadow-none dark:hover:text-ink"
      >
        <Sun className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => selectTheme("dark")}
        aria-label="Dark mode"
        aria-pressed={theme !== null ? theme === "dark" : undefined}
        title="Dark mode"
        className="flex size-7 items-center justify-center rounded-[6px] text-ink-subtle transition-colors hover:text-ink dark:bg-surface dark:text-ink dark:shadow-xs"
      >
        <Moon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
