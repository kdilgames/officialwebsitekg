"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutGrid } from "lucide-react";

import {
  getCategoryIcon,
  getCategoryVisual,
} from "@/components/marketplace/category-visuals";
import {
  buildCategoryTree,
  formatCategoryCount,
  type FlatCategoryRow,
} from "@/lib/catalog-hierarchy";
import { cn } from "@/lib/utils/cn";

export function CategoryNavBar({ categories }: { categories: FlatCategoryRow[] }) {
  const pathname = usePathname();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  const [openState, setOpenState] = useState<{ slug: string; pathname: string } | null>(null);
  const [menuLeft, setMenuLeft] = useState<number>(0);

  const openSlug = openState && openState.pathname === pathname ? openState.slug : null;

  const activeCategorySlug = pathname.startsWith("/category/")
    ? pathname.slice("/category/".length).split("/")[0]
    : null;

  const openNode = useMemo(
    () => (openSlug ? tree.find((node) => node.slug === openSlug) ?? null : null),
    [openSlug, tree],
  );

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      setOpenState(null);
    }, 140);
  }, [cancelScheduledClose]);

  const openForElement = useCallback(
    (slug: string, buttonEl: HTMLElement | null) => {
      cancelScheduledClose();
      if (buttonEl && wrapperRef.current) {
        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        const buttonRect = buttonEl.getBoundingClientRect();
        const menuWidth = 280;
        const maxLeft = Math.max(8, wrapperRect.width - menuWidth - 8);
        const rawLeft = buttonRect.left - wrapperRect.left;
        setMenuLeft(Math.max(8, Math.min(rawLeft, maxLeft)));
      }
      setOpenState({ slug, pathname });
    },
    [cancelScheduledClose, pathname],
  );

  // Dismiss on Escape or clicking outside the bar/dropdown.
  useEffect(() => {
    if (!openSlug) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpenState(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenState(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openSlug]);

  useEffect(() => cancelScheduledClose, [cancelScheduledClose]);

  if (tree.length === 0) return null;

  return (
    <div className="relative z-30 border-b border-line bg-canvas/85 backdrop-blur-sm">
      <div
        ref={wrapperRef}
        className="relative mx-auto max-w-[1400px] px-4 sm:px-6"
        onMouseLeave={scheduleClose}
      >
        <nav
          aria-label="Marketplace categories"
          className="flex h-10 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tree.map((node) => {
            const hasChildren = node.children.length > 0;
            const isOpen = openSlug === node.slug;
            const isActiveRoute =
              activeCategorySlug === node.slug ||
              node.children.some((child) => child.slug === activeCategorySlug);
            const Icon = getCategoryIcon(node.icon, node.slug);

            if (!hasChildren) {
              return (
                <Link
                  key={node.id}
                  href={`/category/${node.slug}`}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[13px] font-medium transition-colors",
                    isActiveRoute
                      ? "bg-elevated text-ink"
                      : "text-ink-muted hover:bg-elevated/70 hover:text-ink",
                  )}
                >
                  <Icon className="size-3.5 text-ink-subtle" aria-hidden />
                  <span>{node.name}</span>
                </Link>
              );
            }

            return (
              <button
                key={node.id}
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onMouseEnter={(event) => openForElement(node.slug, event.currentTarget)}
                onFocus={(event) => openForElement(node.slug, event.currentTarget)}
                onClick={(event) => {
                  if (isOpen) {
                    setOpenState(null);
                  } else {
                    openForElement(node.slug, event.currentTarget);
                  }
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[13px] font-medium transition-colors",
                  isOpen || isActiveRoute
                    ? "bg-elevated text-ink shadow-xs"
                    : "text-ink-muted hover:bg-elevated/70 hover:text-ink",
                )}
              >
                <Icon className="size-3.5 text-ink-subtle" aria-hidden />
                <span>{node.name}</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-ink-subtle transition-transform duration-150",
                    isOpen && "rotate-180 text-accent",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}

          <Link
            href="/browse"
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated/70 hover:text-ink",
              pathname === "/browse" && "text-ink",
            )}
          >
            <LayoutGrid className="size-3.5 text-ink-subtle" aria-hidden />
            <span className="hidden sm:inline">All categories</span>
          </Link>
        </nav>

        {openNode && openNode.children.length > 0 ? (
          <div
            role="menu"
            aria-label={`${openNode.name} subcategories`}
            onMouseEnter={cancelScheduledClose}
            onMouseLeave={scheduleClose}
            style={{ left: `${menuLeft}px` }}
            className="surface absolute top-[calc(100%-2px)] z-50 w-[280px] overflow-hidden border-t-2 border-t-accent p-1.5 shadow-xl"
          >
            {(() => {
              const parentVisual = getCategoryVisual(openNode.slug, openNode.icon);
              const ParentIcon = parentVisual.icon;
              return (
                <>
                  <Link
                    role="menuitem"
                    href={`/category/${openNode.slug}`}
                    onClick={() => setOpenState(null)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold transition-colors",
                      activeCategorySlug === openNode.slug
                        ? "bg-accent-quiet text-accent-ink"
                        : "text-ink hover:bg-elevated",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-[6px] border",
                          parentVisual.chipClass,
                        )}
                      >
                        <ParentIcon className="size-3.5" aria-hidden />
                      </span>
                      <span className="truncate">All {openNode.name}</span>
                    </span>
                    <span className="rounded-md border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-ink-muted">
                      {formatCategoryCount(openNode.totalProducts)}
                    </span>
                  </Link>

                  <div className="my-1.5 border-t border-line" />

                  <div className="max-h-[340px] space-y-0.5 overflow-y-auto pr-0.5">
                    {openNode.children.map((child) => {
                      const ChildIcon = getCategoryIcon(child.icon, child.slug);
                      const childActive = activeCategorySlug === child.slug;
                      return (
                        <Link
                          key={child.id}
                          role="menuitem"
                          href={`/category/${child.slug}`}
                          onClick={() => setOpenState(null)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-[7px] px-2.5 py-1.5 text-[13px] transition-colors",
                            childActive
                              ? "bg-accent-quiet font-medium text-accent-ink"
                              : "text-ink-muted hover:bg-elevated hover:text-ink",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <ChildIcon
                              className={cn(
                                "size-4 shrink-0",
                                childActive ? "text-accent" : "text-ink-subtle",
                              )}
                              aria-hidden
                            />
                            <span className="truncate">{child.name}</span>
                          </span>
                          <span className="rounded-md border border-line bg-elevated/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-ink-subtle">
                            {formatCategoryCount(child.directProducts)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </div>
    </div>
  );
}
