"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  AlignCenter,
  Bold,
  Code2,
  Eye,
  EyeOff,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  PenLine,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";

import { BBCodeContent } from "@/components/ui/bbcode-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const COLOR_SWATCHES = [
  { label: "Cobalt", hex: "#2563eb" },
  { label: "Sky", hex: "#0ea5e9" },
  { label: "Emerald", hex: "#16a34a" },
  { label: "Amber", hex: "#d97706" },
  { label: "Orange", hex: "#ea580c" },
  { label: "Rose", hex: "#e11d48" },
  { label: "Violet", hex: "#7c3aed" },
  { label: "Slate", hex: "#64748b" },
];

export function BBCodeEditor({
  id,
  name,
  defaultValue = "",
  value,
  onChange,
  rows = 8,
  maxLength = 20000,
  required = false,
  placeholder,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (next: string) => void;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value !== undefined ? value : internalValue;

  const [mode, setMode] = useState<"write" | "preview">("write");
  const [activePopover, setActivePopover] = useState<"color" | "url" | "img" | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  function updateValue(next: string, nextSelectionStart?: number, nextSelectionEnd?: number) {
    const clamped = maxLength ? next.slice(0, maxLength) : next;
    if (value === undefined) {
      setInternalValue(clamped);
    }
    onChange?.(clamped);

    if (nextSelectionStart !== undefined) {
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextSelectionStart, nextSelectionEnd ?? nextSelectionStart);
      });
    }
  }

  function wrapSelection(prefix: string, suffix: string, fallbackPlaceholder = "text") {
    const el = textareaRef.current;
    if (mode !== "write" || !el) {
      updateValue(`${currentValue}${prefix}${fallbackPlaceholder}${suffix}`);
      return;
    }

    const start = el.selectionStart ?? currentValue.length;
    const end = el.selectionEnd ?? currentValue.length;
    const selected = currentValue.slice(start, end);
    const inner = selected || fallbackPlaceholder;
    const next = `${currentValue.slice(0, start)}${prefix}${inner}${suffix}${currentValue.slice(end)}`;
    const selStart = start + prefix.length;
    const selEnd = selStart + inner.length;
    updateValue(next, selStart, selEnd);
  }

  function insertList(ordered: boolean) {
    const tag = ordered ? "[list=1]" : "[list]";
    const el = textareaRef.current;
    if (mode !== "write" || !el) {
      updateValue(`${currentValue}${currentValue ? "\n" : ""}${tag}\n[*]First item\n[*]Second item\n[/list]`);
      return;
    }

    const start = el.selectionStart ?? currentValue.length;
    const end = el.selectionEnd ?? currentValue.length;
    const selected = currentValue.slice(start, end).trim();
    const lines = selected
      ? selected
          .split(/\r?\n/)
          .map((line) => line.replace(/^[-*•]\s*/, "").trim())
          .filter(Boolean)
      : ["First item", "Second item"];

    const block = `${tag}\n${lines.map((line) => `[*]${line}`).join("\n")}\n[/list]`;
    const before = currentValue.slice(0, start);
    const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
    const insertText = `${needsLeadingNewline ? "\n" : ""}${block}`;
    const next = `${before}${insertText}${currentValue.slice(end)}`;
    const caret = before.length + insertText.length;
    updateValue(next, caret, caret);
  }

  function insertCode() {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? currentValue.length;
    const end = el?.selectionEnd ?? currentValue.length;
    const selected = currentValue.slice(start, end);
    if (selected && !selected.includes("\n")) {
      wrapSelection("[icode]", "[/icode]", "code");
      return;
    }
    wrapSelection("[code]\n", "\n[/code]", "Your snippet here");
  }

  function insertDivider() {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? currentValue.length;
    const end = el?.selectionEnd ?? currentValue.length;
    const before = currentValue.slice(0, start);
    const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    const snippet = `${prefix}[hr]\n`;
    const next = `${before}${snippet}${currentValue.slice(end)}`;
    const caret = before.length + snippet.length;
    updateValue(next, caret, caret);
  }

  function insertUrlFromForm() {
    const clean = linkUrl.trim();
    if (!clean) return;
    const label = linkLabel.trim();
    const snippet = label ? `[url=${clean}]${label}[/url]` : `[url=${clean}]${clean}[/url]`;
    const el = textareaRef.current;
    const start = mode === "write" && el ? (el.selectionStart ?? currentValue.length) : currentValue.length;
    const end = mode === "write" && el ? (el.selectionEnd ?? currentValue.length) : currentValue.length;
    const next = `${currentValue.slice(0, start)}${snippet}${currentValue.slice(end)}`;
    const caret = start + snippet.length;
    updateValue(next, caret, caret);
    setLinkUrl("");
    setLinkLabel("");
    setActivePopover(null);
  }

  function insertImageFromForm() {
    const clean = imageUrl.trim();
    if (!clean) return;
    const snippet = `[img]${clean}[/img]`;
    const el = textareaRef.current;
    const start = mode === "write" && el ? (el.selectionStart ?? currentValue.length) : currentValue.length;
    const end = mode === "write" && el ? (el.selectionEnd ?? currentValue.length) : currentValue.length;
    const next = `${currentValue.slice(0, start)}${snippet}${currentValue.slice(end)}`;
    const caret = start + snippet.length;
    updateValue(next, caret, caret);
    setImageUrl("");
    setActivePopover(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      wrapSelection("[b]", "[/b]", "bold text");
    } else if (key === "i") {
      event.preventDefault();
      wrapSelection("[i]", "[/i]", "italic text");
    } else if (key === "u") {
      event.preventDefault();
      wrapSelection("[u]", "[/u]", "underlined text");
    }
  }

  return (
    <div className="overflow-hidden rounded-[9px] border border-line bg-surface transition-colors focus-within:border-accent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-elevated/70 px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton
            title="Bold (Ctrl+B)"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[b]", "[/b]", "bold text")}
          >
            <Bold className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Italic (Ctrl+I)"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[i]", "[/i]", "italic text")}
          >
            <Italic className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Underline (Ctrl+U)"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[u]", "[/u]", "underlined text")}
          >
            <Underline className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[s]", "[/s]", "strikethrough")}
          >
            <Strikethrough className="size-3.5" aria-hidden />
          </ToolbarButton>

          <span className="mx-1 h-4 w-px bg-line" aria-hidden />

          <ToolbarButton
            title="Heading 2 ([h2])"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[h2]", "[/h2]", "Section heading")}
          >
            <Heading2 className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3 ([h3])"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[h3]", "[/h3]", "Subheading")}
          >
            <Heading3 className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Text color ([color=...])"
            disabled={mode === "preview"}
            active={activePopover === "color"}
            onClick={() => setActivePopover((cur) => (cur === "color" ? null : "color"))}
          >
            <Palette className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Center align ([center])"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[center]", "[/center]", "Centered text")}
          >
            <AlignCenter className="size-3.5" aria-hidden />
          </ToolbarButton>

          <span className="mx-1 h-4 w-px bg-line" aria-hidden />

          <ToolbarButton
            title="Bullet list ([list])"
            disabled={mode === "preview"}
            onClick={() => insertList(false)}
          >
            <List className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list ([list=1])"
            disabled={mode === "preview"}
            onClick={() => insertList(true)}
          >
            <ListOrdered className="size-3.5" aria-hidden />
          </ToolbarButton>

          <span className="mx-1 h-4 w-px bg-line" aria-hidden />

          <ToolbarButton
            title="Insert link ([url=...])"
            disabled={mode === "preview"}
            active={activePopover === "url"}
            onClick={() => setActivePopover((cur) => (cur === "url" ? null : "url"))}
          >
            <Link2 className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Insert image ([img]...[/img])"
            disabled={mode === "preview"}
            active={activePopover === "img"}
            onClick={() => setActivePopover((cur) => (cur === "img" ? null : "img"))}
          >
            <ImageIcon className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Code snippet ([code] or [icode])"
            disabled={mode === "preview"}
            onClick={insertCode}
          >
            <Code2 className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Quote block ([quote])"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[quote]\n", "\n[/quote]", "Quoted text")}
          >
            <Quote className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Spoiler section ([spoiler=Details])"
            disabled={mode === "preview"}
            onClick={() => wrapSelection("[spoiler=Details]\n", "\n[/spoiler]", "Hidden details")}
          >
            <EyeOff className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Horizontal divider ([hr])"
            disabled={mode === "preview"}
            onClick={insertDivider}
          >
            <Minus className="size-3.5" aria-hidden />
          </ToolbarButton>
        </div>

        <div className="inline-flex rounded-[7px] border border-line bg-surface p-0.5 text-[11.5px]">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={cn(
              "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 font-medium transition-colors",
              mode === "write" ? "bg-elevated text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <PenLine className="size-3" aria-hidden />
            Write
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePopover(null);
              setMode("preview");
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 font-medium transition-colors",
              mode === "preview" ? "bg-elevated text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <Eye className="size-3" aria-hidden />
            Preview
          </button>
        </div>
      </div>

      {activePopover === "color" && mode === "write" ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-elevated/40 px-3 py-2">
          <span className="subtle mr-1 text-[11.5px]">Pick color:</span>
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              title={`${swatch.label} (${swatch.hex})`}
              onClick={() => {
                wrapSelection(`[color=${swatch.hex}]`, "[/color]", "colored text");
                setActivePopover(null);
              }}
              className="size-5 rounded-full border border-line-strong transition-transform hover:scale-110"
              style={{ backgroundColor: swatch.hex }}
            />
          ))}
        </div>
      ) : null}

      {activePopover === "url" && mode === "write" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-elevated/40 px-3 py-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com"
            className="input h-8 min-w-[180px] flex-1 text-[12.5px]"
          />
          <input
            type="text"
            value={linkLabel}
            onChange={(event) => setLinkLabel(event.target.value)}
            placeholder="Link text (optional)"
            className="input h-8 w-44 text-[12.5px]"
          />
          <Button type="button" variant="primary" size="sm" onClick={insertUrlFromForm}>
            Insert link
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setActivePopover(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {activePopover === "img" && mode === "write" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-elevated/40 px-3 py-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://cdn.example.com/banner.png"
            className="input h-8 min-w-[220px] flex-1 text-[12.5px]"
          />
          <Button type="button" variant="primary" size="sm" onClick={insertImageFromForm}>
            Insert image
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setActivePopover(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          rows={rows}
          value={currentValue}
          onChange={(event) => updateValue(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          required={required}
          placeholder={
            placeholder ??
            "Supports BBCode formatting: [b]bold[/b], [h2]Headings[/h2], [list][*]Feature[/list], [color=#3b82f6]color[/color], [url=...]link[/url], [img]...[/img]"
          }
          className="block w-full resize-y bg-transparent px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-subtle"
        />
      ) : (
        <>
          <input type="hidden" name={name} value={currentValue} />
          <div
            className="overflow-y-auto px-4 py-3"
            style={{ minHeight: `${Math.max(120, rows * 22)}px` }}
          >
            {currentValue.trim() ? (
              <BBCodeContent value={currentValue} />
            ) : (
              <p className="subtle text-[13px] italic">Nothing to preview yet.</p>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-line bg-elevated/40 px-3 py-1 text-[11px] text-ink-subtle">
        <span>BBCode formatting supported · Toggle Preview to inspect live layout</span>
        <span className="font-mono tabular-nums">
          {currentValue.length.toLocaleString("en-US")} / {maxLength.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}

function ToolbarButton({
  title,
  disabled,
  active,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors disabled:opacity-40",
        active
          ? "bg-accent-quiet text-accent"
          : "hover:bg-surface hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
