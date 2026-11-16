import { safeHttpUrl } from "./utils/media";

/**
 * Safe BBCode tokenizer & AST parser.
 *
 * Produces structured AST nodes without generating raw HTML strings, ensuring
 * JSX text-escaping prevents HTML injection and URLs are restricted strictly
 * to HTTP(S) protocols via `safeHttpUrl`.
 */

export type BbSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl";

export type BbNode =
  | { type: "text"; text: string }
  | { type: "br" }
  | { type: "hr" }
  | { type: "bold"; children: BbNode[] }
  | { type: "italic"; children: BbNode[] }
  | { type: "underline"; children: BbNode[] }
  | { type: "strike"; children: BbNode[] }
  | { type: "heading"; level: 1 | 2 | 3; children: BbNode[] }
  | { type: "align"; align: "left" | "center" | "right"; children: BbNode[] }
  | { type: "color"; color: string; children: BbNode[] }
  | { type: "size"; size: BbSize; children: BbNode[] }
  | { type: "url"; href: string; children: BbNode[] }
  | { type: "img"; src: string; alt?: string }
  | { type: "quote"; author?: string; children: BbNode[] }
  | { type: "code"; language?: string; content: string }
  | { type: "icode"; content: string }
  | { type: "spoiler"; title?: string; children: BbNode[] }
  | { type: "list"; ordered: boolean; items: BbNode[][] };

const MAX_PARSE_DEPTH = 24;

const NAMED_COLORS = new Set([
  "red",
  "crimson",
  "coral",
  "orange",
  "amber",
  "gold",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "magenta",
  "pink",
  "rose",
  "white",
  "black",
  "silver",
  "gray",
  "grey",
]);

const COLOR_HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function sanitizeBbColor(raw?: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  if (COLOR_HEX_RE.test(cleaned)) return cleaned.toLowerCase();
  const lower = cleaned.toLowerCase();
  return NAMED_COLORS.has(lower) ? lower : null;
}

export function normalizeBbSize(raw?: string): BbSize | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").toLowerCase();
  const numeric = Number.parseFloat(cleaned.replace(/px$/, ""));
  if (!Number.isFinite(numeric)) return null;

  // Classic BBCode scale (1..7)
  if (numeric >= 1 && numeric <= 7 && !cleaned.endsWith("px")) {
    if (numeric <= 1) return "xs";
    if (numeric === 2) return "sm";
    if (numeric === 3) return "base";
    if (numeric === 4) return "lg";
    if (numeric === 5) return "xl";
    return "2xl";
  }

  // Pixel scale (clamped to readable bounds)
  if (numeric <= 11) return "xs";
  if (numeric <= 13) return "sm";
  if (numeric <= 15) return "base";
  if (numeric <= 18) return "lg";
  if (numeric <= 22) return "xl";
  return "2xl";
}

function cleanAttr(attr?: string): string {
  if (!attr) return "";
  return attr.trim().replace(/^["']|["']$/g, "").trim();
}

type Token =
  | { kind: "text"; value: string }
  | { kind: "open"; name: string; attr?: string; raw: string }
  | { kind: "close"; name: string; raw: string }
  | { kind: "star"; raw: string };

const TAG_NAMES = new Set([
  "b",
  "i",
  "u",
  "s",
  "strike",
  "h1",
  "h2",
  "h3",
  "center",
  "left",
  "right",
  "color",
  "size",
  "url",
  "img",
  "quote",
  "code",
  "icode",
  "c",
  "list",
  "li",
  "spoiler",
  "hr",
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    const openIdx = input.indexOf("[", cursor);
    if (openIdx === -1) {
      tokens.push({ kind: "text", value: input.slice(cursor) });
      break;
    }

    if (openIdx > cursor) {
      tokens.push({ kind: "text", value: input.slice(cursor, openIdx) });
    }

    const closeIdx = input.indexOf("]", openIdx + 1);
    if (closeIdx === -1) {
      tokens.push({ kind: "text", value: input.slice(openIdx) });
      break;
    }

    const inner = input.slice(openIdx + 1, closeIdx);
    const raw = input.slice(openIdx, closeIdx + 1);

    // Handle [*] list bullet token cleanly without breaking `[something]` text.
    if (inner.trim() === "*") {
      tokens.push({ kind: "star", raw });
      cursor = closeIdx + 1;
      continue;
    }

    const isClose = inner.startsWith("/");
    const body = (isClose ? inner.slice(1) : inner).trim();
    const eqIndex = body.indexOf("=");
    const name = (eqIndex === -1 ? body : body.slice(0, eqIndex)).trim().toLowerCase();

    if (!name || !TAG_NAMES.has(name) || (isClose && eqIndex !== -1)) {
      tokens.push({ kind: "text", value: raw });
      cursor = closeIdx + 1;
      continue;
    }

    if (isClose) {
      tokens.push({ kind: "close", name, raw });
    } else {
      const attr = eqIndex === -1 ? undefined : body.slice(eqIndex + 1);
      tokens.push({ kind: "open", name, attr, raw });
    }

    cursor = closeIdx + 1;
  }

  return tokens;
}

const BLOCK_TAGS = new Set(["h1", "h2", "h3", "center", "left", "right", "quote", "code", "list", "spoiler", "hr"]);

function trimLeadingBoundaryBreaks(nodes: BbNode[]): BbNode[] {
  const result = [...nodes];
  while (result.length > 0) {
    const first = result[0];
    if (first?.type === "br") {
      result.shift();
      continue;
    }
    if (first?.type === "text" && /^\s+$/.test(first.text)) {
      result.shift();
      continue;
    }
    break;
  }
  return result;
}

function trimTrailingBoundaryBreaks(nodes: BbNode[]): BbNode[] {
  const result = [...nodes];
  while (result.length > 0) {
    const last = result[result.length - 1];
    if (last?.type === "br") {
      result.pop();
      continue;
    }
    if (last?.type === "text" && /^\s+$/.test(last.text)) {
      result.pop();
      continue;
    }
    break;
  }
  return result;
}

function appendTextWithBreaks(target: BbNode[], value: string) {
  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (i > 0) {
      target.push({ type: "br" });
    }
    const line = lines[i];
    if (line && line.length > 0) {
      target.push({ type: "text", text: line });
    }
  }
}

function textContentOf(nodes: BbNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text;
      if (node.type === "br") return "\n";
      if ("children" in node) return textContentOf(node.children);
      if ("content" in node) return node.content;
      return "";
    })
    .join("");
}

export function parseBbcode(input: string | null | undefined): BbNode[] {
  if (!input || !input.trim()) return [];
  const tokens = tokenize(input);

  function findClosingIndex(startIdx: number, tagName: string): number {
    for (let i = startIdx; i < tokens.length; i += 1) {
      const tok = tokens[i];
      if (tok?.kind === "close" && tok.name === tagName) {
        return i;
      }
    }
    return -1;
  }

  function parseRange(
    startIdx: number,
    stopTag: string | null,
    depth: number,
  ): { nodes: BbNode[]; nextIdx: number; closedByStopTag: boolean } {
    const nodes: BbNode[] = [];
    let i = startIdx;

    while (i < tokens.length) {
      const token = tokens[i];
      if (!token) break;

      if (token.kind === "close") {
        if (stopTag && token.name === stopTag) {
          return { nodes, nextIdx: i + 1, closedByStopTag: true };
        }
        // Unmatched stray close tag: preserve literally as text.
        nodes.push({ type: "text", text: token.raw });
        i += 1;
        continue;
      }

      if (token.kind === "text") {
        appendTextWithBreaks(nodes, token.value);
        i += 1;
        continue;
      }

      if (token.kind === "star") {
        nodes.push({ type: "text", text: token.raw });
        i += 1;
        continue;
      }

      // Opening tag
      if (token.name === "hr") {
        nodes.push({ type: "hr" });
        i += 1;
        continue;
      }

      if (depth >= MAX_PARSE_DEPTH) {
        nodes.push({ type: "text", text: token.raw });
        i += 1;
        continue;
      }

      // Verbatim tags `[code]` & `[icode]` / `[c]`
      if (token.name === "code" || token.name === "icode" || token.name === "c") {
        const closeIdx = findClosingIndex(i + 1, token.name);
        if (closeIdx === -1) {
          nodes.push({ type: "text", text: token.raw });
          i += 1;
          continue;
        }
        const rawInner = tokens
          .slice(i + 1, closeIdx)
          .map((t) => (t.kind === "text" ? t.value : t.raw))
          .join("");
        if (token.name === "code") {
          const lang = cleanAttr(token.attr);
          nodes.push({
            type: "code",
            language: lang || undefined,
            content: rawInner.replace(/^\r?\n|\r?\n$/g, ""),
          });
        } else {
          nodes.push({ type: "icode", content: rawInner.trim() });
        }
        i = closeIdx + 1;
        continue;
      }

      // Structured `[list]` container supporting `[*]` and `[li]...[/li]` plus nested lists
      if (token.name === "list") {
        const listRes = parseListAt(i, depth + 1);
        nodes.push(...listRes.nodes);
        i = listRes.nextIdx;
        continue;
      }

      const parsedTag = parseTag(token, i + 1, depth + 1);
      nodes.push(...parsedTag.nodes);
      i = parsedTag.nextIdx;
    }

    return { nodes, nextIdx: i, closedByStopTag: false };
  }

  function parseTag(
    openToken: Extract<Token, { kind: "open" }>,
    afterOpenIdx: number,
    depth: number,
  ): { nodes: BbNode[]; nextIdx: number } {
    if (openToken.name === "list") {
      // Delegate back cleanly through a sub-slice starting at openToken
      const subResult = parseListAt(afterOpenIdx - 1, depth);
      return subResult;
    }

    if (openToken.name === "hr") {
      return { nodes: [{ type: "hr" }], nextIdx: afterOpenIdx };
    }

    const inner = parseRange(afterOpenIdx, openToken.name, depth);
    if (!inner.closedByStopTag) {
      return { nodes: [{ type: "text", text: openToken.raw }, ...inner.nodes], nextIdx: inner.nextIdx };
    }

    const children = BLOCK_TAGS.has(openToken.name)
      ? trimLeadingBoundaryBreaks(trimTrailingBoundaryBreaks(inner.nodes))
      : inner.nodes;

    switch (openToken.name) {
      case "b":
        return { nodes: [{ type: "bold", children }], nextIdx: inner.nextIdx };
      case "i":
        return { nodes: [{ type: "italic", children }], nextIdx: inner.nextIdx };
      case "u":
        return { nodes: [{ type: "underline", children }], nextIdx: inner.nextIdx };
      case "s":
      case "strike":
        return { nodes: [{ type: "strike", children }], nextIdx: inner.nextIdx };
      case "h1":
        return { nodes: [{ type: "heading", level: 1, children }], nextIdx: inner.nextIdx };
      case "h2":
        return { nodes: [{ type: "heading", level: 2, children }], nextIdx: inner.nextIdx };
      case "h3":
        return { nodes: [{ type: "heading", level: 3, children }], nextIdx: inner.nextIdx };
      case "center":
        return { nodes: [{ type: "align", align: "center", children }], nextIdx: inner.nextIdx };
      case "left":
        return { nodes: [{ type: "align", align: "left", children }], nextIdx: inner.nextIdx };
      case "right":
        return { nodes: [{ type: "align", align: "right", children }], nextIdx: inner.nextIdx };
      case "color": {
        const color = sanitizeBbColor(openToken.attr);
        if (!color) return { nodes: children, nextIdx: inner.nextIdx };
        return { nodes: [{ type: "color", color, children }], nextIdx: inner.nextIdx };
      }
      case "size": {
        const size = normalizeBbSize(openToken.attr);
        if (!size) return { nodes: children, nextIdx: inner.nextIdx };
        return { nodes: [{ type: "size", size, children }], nextIdx: inner.nextIdx };
      }
      case "url": {
        const attrHref = cleanAttr(openToken.attr);
        const bodyText = textContentOf(children).trim();
        const safeHref = safeHttpUrl(attrHref || bodyText);
        if (!safeHref) {
          return { nodes: children.length > 0 ? children : [{ type: "text", text: openToken.raw }], nextIdx: inner.nextIdx };
        }
        const linkChildren =
          children.length > 0 ? children : [{ type: "text" as const, text: safeHref }];
        return { nodes: [{ type: "url", href: safeHref, children: linkChildren }], nextIdx: inner.nextIdx };
      }
      case "img": {
        const srcText = textContentOf(children).trim();
        const safeSrc = safeHttpUrl(srcText);
        if (!safeSrc) {
          return { nodes: children.length > 0 ? children : [{ type: "text", text: openToken.raw }], nextIdx: inner.nextIdx };
        }
        const alt = cleanAttr(openToken.attr) || undefined;
        return { nodes: [{ type: "img", src: safeSrc, alt }], nextIdx: inner.nextIdx };
      }
      case "quote": {
        const author = cleanAttr(openToken.attr) || undefined;
        return { nodes: [{ type: "quote", author, children }], nextIdx: inner.nextIdx };
      }
      case "spoiler": {
        const title = cleanAttr(openToken.attr) || undefined;
        return { nodes: [{ type: "spoiler", title, children }], nextIdx: inner.nextIdx };
      }
      case "li":
        return { nodes: children, nextIdx: inner.nextIdx };
      default:
        return { nodes: children, nextIdx: inner.nextIdx };
    }
  }

  function parseListAt(listOpenIdx: number, depth: number): { nodes: BbNode[]; nextIdx: number } {
    const token = tokens[listOpenIdx];
    if (!token || token.kind !== "open" || token.name !== "list") {
      return { nodes: [], nextIdx: listOpenIdx + 1 };
    }
    const ordered = /^(?:1|a|i|decimal|ordered)$/i.test(cleanAttr(token.attr));
    const items: BbNode[][] = [];
    let currentItem: BbNode[] | null = null;
    let cursor = listOpenIdx + 1;
    let closed = false;

    while (cursor < tokens.length) {
      const innerTok = tokens[cursor];
      if (!innerTok) break;

      if (innerTok.kind === "close" && innerTok.name === "list") {
        closed = true;
        cursor += 1;
        break;
      }

      if (innerTok.kind === "star") {
        if (currentItem) items.push(trimLeadingBoundaryBreaks(trimTrailingBoundaryBreaks(currentItem)));
        currentItem = [];
        cursor += 1;
        continue;
      }

      if (innerTok.kind === "open" && innerTok.name === "li") {
        if (currentItem) items.push(trimLeadingBoundaryBreaks(trimTrailingBoundaryBreaks(currentItem)));
        const liInner = parseRange(cursor + 1, "li", depth + 1);
        items.push(trimLeadingBoundaryBreaks(trimTrailingBoundaryBreaks(liInner.nodes)));
        currentItem = null;
        cursor = liInner.nextIdx;
        continue;
      }

      if (innerTok.kind === "open") {
        const sub =
          innerTok.name === "list"
            ? depth < MAX_PARSE_DEPTH
              ? parseListAt(cursor, depth + 1)
              : { nodes: [{ type: "text" as const, text: innerTok.raw }], nextIdx: cursor + 1 }
            : parseTag(innerTok, cursor + 1, depth + 1);
        if (!currentItem) currentItem = [];
        currentItem.push(...sub.nodes);
        cursor = sub.nextIdx;
        continue;
      }

      if (innerTok.kind === "text") {
        if (currentItem) {
          appendTextWithBreaks(currentItem, innerTok.value);
        } else if (innerTok.value.trim().length > 0) {
          currentItem = [];
          appendTextWithBreaks(currentItem, innerTok.value);
        }
        cursor += 1;
        continue;
      }

      if (innerTok.kind === "close") {
        if (currentItem) currentItem.push({ type: "text", text: innerTok.raw });
        cursor += 1;
      }
    }

    if (currentItem) {
      const cleaned = trimLeadingBoundaryBreaks(trimTrailingBoundaryBreaks(currentItem));
      if (cleaned.length > 0) items.push(cleaned);
    }

    if (!closed && items.length === 0) {
      return { nodes: [{ type: "text", text: token.raw }], nextIdx: listOpenIdx + 1 };
    }

    return {
      nodes: [{ type: "list", ordered, items }],
      nextIdx: cursor,
    };
  }

  // Note: replace duplicate inline list branch smoothly inside parseRange?
  // Let's keep parseRange calling parseListAt when token.name === "list"!
  return parseRange(0, null, 0).nodes;
}

/**
 * Strips BBCode tags cleanly for plain-text excerpts, search snippets, and notifications.
 */
export function stripBbcode(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\[update-title\][\s\S]*?\[\/update-title\]/gi, " ")
    .replace(/\[\*\]/g, " • ")
    .replace(/\[\/?(?:b|i|u|s|strike|h1|h2|h3|center|left|right|color|size|url|img|quote|code|icode|c|list|li|spoiler|hr)(?:=[^\]]*)?\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
