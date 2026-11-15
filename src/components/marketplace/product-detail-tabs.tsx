"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FileText, History, MessageSquare, Star } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type ProductTabKey = "overview" | "updates" | "reviews" | "qa";

export function normalizeProductTab(raw: string | undefined): ProductTabKey {
  if (raw === "updates" || raw === "reviews" || raw === "qa") return raw;
  return "overview";
}

export function ProductDetailTabs({
  initialTab = "overview",
  updatesCount,
  reviewsCount,
  questionsCount,
  overviewContent,
  updatesContent,
  reviewsContent,
  qaContent,
}: {
  initialTab?: ProductTabKey;
  updatesCount: number;
  reviewsCount: number;
  questionsCount: number;
  overviewContent: ReactNode;
  updatesContent: ReactNode;
  reviewsContent: ReactNode;
  qaContent: ReactNode;
}) {
  const pathname = usePathname();
  const [overrideTab, setOverrideTab] = useState<{
    tab: ProductTabKey;
    forInitial: ProductTabKey;
  } | null>(null);
  const activeTab =
    overrideTab && overrideTab.forInitial === initialTab ? overrideTab.tab : initialTab;

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#qa") {
        setOverrideTab({ tab: "qa", forInitial: initialTab });
        document.getElementById("qa")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    const raf = window.location.hash === "#qa" ? requestAnimationFrame(syncFromHash) : null;

    function onTabEvent(event: Event) {
      const detail = (event as CustomEvent<ProductTabKey>).detail;
      if (detail === "overview" || detail === "updates" || detail === "reviews" || detail === "qa") {
        setOverrideTab({ tab: detail, forInitial: initialTab });
      }
    }

    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("product-tab-change", onTabEvent);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("product-tab-change", onTabEvent);
    };
  }, [initialTab]);

  function selectTab(next: ProductTabKey) {
    setOverrideTab({ tab: next, forInitial: initialTab });
    const nextUrl = next === "overview" ? pathname : `${pathname}?tab=${next}`;
    window.history.replaceState(null, "", nextUrl);
  }

  const tabs: Array<{
    key: ProductTabKey;
    label: string;
    count?: number;
    icon: ReactNode;
  }> = [
    {
      key: "overview",
      label: "Overview",
      icon: <FileText className="size-3.5" aria-hidden />,
    },
    {
      key: "updates",
      label: "Updates",
      count: updatesCount,
      icon: <History className="size-3.5" aria-hidden />,
    },
    {
      key: "reviews",
      label: "Reviews",
      count: reviewsCount,
      icon: <Star className="size-3.5" aria-hidden />,
    },
    {
      key: "qa",
      label: "Q&A",
      count: questionsCount,
      icon: <MessageSquare className="size-3.5" aria-hidden />,
    },
  ];

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Product sections"
        className="flex items-center gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(tab.key)}
              className={cn(
                "relative inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors",
                isActive ? "text-accent" : "text-ink-muted hover:text-ink",
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    isActive ? "bg-accent/12 text-accent" : "bg-elevated text-ink-subtle",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={activeTab === "overview" ? "block" : "hidden"} role="tabpanel">
        {overviewContent}
      </div>
      <div className={activeTab === "updates" ? "block" : "hidden"} role="tabpanel">
        {updatesContent}
      </div>
      <div className={activeTab === "reviews" ? "block" : "hidden"} role="tabpanel">
        {reviewsContent}
      </div>
      <div className={activeTab === "qa" ? "block" : "hidden"} role="tabpanel">
        {qaContent}
      </div>
    </div>
  );
}

export function ProductTabJumpButton({
  targetTab,
  children,
  className,
}: {
  targetTab: ProductTabKey;
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <button
      type="button"
      onClick={() => {
        const nextUrl = targetTab === "overview" ? pathname : `${pathname}?tab=${targetTab}`;
        window.history.replaceState(null, "", nextUrl);
        window.dispatchEvent(new CustomEvent("product-tab-change", { detail: targetTab }));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={className}
    >
      {children}
    </button>
  );
}
