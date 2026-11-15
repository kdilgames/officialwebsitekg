import type { ReactNode } from "react";

import { parseBbcode, type BbNode, type BbSize } from "@/lib/bbcode";
import { cn } from "@/lib/utils/cn";

const SIZE_CLASSES: Record<BbSize, string> = {
  xs: "text-[11.5px]",
  sm: "text-[12.5px]",
  base: "text-[14px]",
  lg: "text-[16px]",
  xl: "text-[18.5px]",
  "2xl": "text-[22px] font-semibold leading-snug",
};

function renderNodes(nodes: BbNode[], keyPrefix = "bb"): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.type) {
      case "text":
        return node.text;

      case "br":
        return <br key={key} />;

      case "hr":
        return <hr key={key} className="my-4 border-line" />;

      case "bold":
        return (
          <strong key={key} className="font-semibold text-ink">
            {renderNodes(node.children, key)}
          </strong>
        );

      case "italic":
        return (
          <em key={key} className="italic">
            {renderNodes(node.children, key)}
          </em>
        );

      case "underline":
        return (
          <span key={key} className="underline underline-offset-2">
            {renderNodes(node.children, key)}
          </span>
        );

      case "strike":
        return (
          <del key={key} className="line-through opacity-75">
            {renderNodes(node.children, key)}
          </del>
        );

      case "heading":
        if (node.level === 1) {
          return (
            <h2
              key={key}
              className="mt-4 mb-2 text-[19px] font-bold leading-snug tracking-tight text-ink first:mt-0"
            >
              {renderNodes(node.children, key)}
            </h2>
          );
        }
        if (node.level === 2) {
          return (
            <h3
              key={key}
              className="mt-3.5 mb-1.5 text-[16.5px] font-semibold leading-snug tracking-tight text-ink first:mt-0"
            >
              {renderNodes(node.children, key)}
            </h3>
          );
        }
        return (
          <h4
            key={key}
            className="mt-3 mb-1 text-[14.5px] font-semibold leading-snug text-ink first:mt-0"
          >
            {renderNodes(node.children, key)}
          </h4>
        );

      case "align":
        return (
          <div
            key={key}
            className={cn(
              "my-1.5",
              node.align === "center"
                ? "text-center"
                : node.align === "right"
                  ? "text-right"
                  : "text-left",
            )}
          >
            {renderNodes(node.children, key)}
          </div>
        );

      case "color":
        return (
          <span key={key} style={{ color: node.color }}>
            {renderNodes(node.children, key)}
          </span>
        );

      case "size":
        return (
          <span key={key} className={SIZE_CLASSES[node.size]}>
            {renderNodes(node.children, key)}
          </span>
        );

      case "url":
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
          >
            {renderNodes(node.children, key)}
          </a>
        );

      case "img":
        return (
          <span key={key} className="my-2.5 block">
            {/* eslint-disable-next-line @next/next/no-img-element -- seller-supplied external BBCode images */}
            <img
              src={node.src}
              alt={node.alt ?? "Embedded listing image"}
              loading="lazy"
              className="max-h-[520px] max-w-full rounded-[10px] border border-line object-contain"
            />
          </span>
        );

      case "quote":
        return (
          <blockquote
            key={key}
            className="my-3 rounded-r-[9px] border-l-[3px] border-accent bg-elevated/70 px-4 py-3 text-[13.5px] text-ink-muted"
          >
            {node.author ? (
              <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink">
                {node.author}
              </p>
            ) : null}
            <div>{renderNodes(node.children, key)}</div>
          </blockquote>
        );

      case "code":
        return (
          <div key={key} className="my-3 overflow-hidden rounded-[9px] border border-line bg-elevated">
            {node.language ? (
              <div className="border-b border-line bg-surface/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.04em] text-ink-subtle">
                {node.language}
              </div>
            ) : null}
            <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-ink">
              <code>{node.content}</code>
            </pre>
          </div>
        );

      case "icode":
        return (
          <code
            key={key}
            className="rounded-[5px] border border-line bg-elevated px-1.5 py-0.5 font-mono text-[12.5px] text-ink"
          >
            {node.content}
          </code>
        );

      case "spoiler":
        return (
          <details
            key={key}
            className="my-2.5 rounded-[9px] border border-line bg-elevated/60 px-3.5 py-2.5"
          >
            <summary className="cursor-pointer select-none text-[13px] font-medium text-ink">
              {node.title ?? "Reveal spoiler"}
            </summary>
            <div className="mt-2 border-t border-line/70 pt-2 text-[13.5px] text-ink-muted">
              {renderNodes(node.children, key)}
            </div>
          </details>
        );

      case "list": {
        const ListTag = node.ordered ? "ol" : "ul";
        return (
          <ListTag
            key={key}
            className={cn(
              "my-2 space-y-1.5 pl-5",
              node.ordered ? "list-decimal" : "list-disc [&_ul]:mt-1.5 [&_ul]:list-[circle]",
            )}
          >
            {node.items.map((itemNodes, itemIndex) => (
              <li key={`${key}-li-${itemIndex}`} className="leading-relaxed">
                {renderNodes(itemNodes, `${key}-li-${itemIndex}`)}
              </li>
            ))}
          </ListTag>
        );
      }

      default:
        return null;
    }
  });
}

export function BBCodeContent({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const nodes = parseBbcode(value);
  if (nodes.length === 0) return null;

  return (
    <div className={cn("text-[14px] leading-relaxed text-ink-muted break-words", className)}>
      {renderNodes(nodes)}
    </div>
  );
}
