import { describe, expect, it } from "vitest";

import { normalizeBbSize, parseBbcode, sanitizeBbColor, stripBbcode } from "../bbcode";

describe("bbcode parser & sanitizer", () => {
  it("parses nested inline formatting tags cleanly", () => {
    const ast = parseBbcode("[b]Hello [i]world[/i][/b]");
    expect(ast).toEqual([
      {
        type: "bold",
        children: [
          { type: "text", text: "Hello " },
          { type: "italic", children: [{ type: "text", text: "world" }] },
        ],
      },
    ]);
  });

  it("parses headings, center alignment, dividers, quotes, spoilers, and code blocks", () => {
    const ast = parseBbcode(
      "[h2]Features[/h2]\n[center]Centered[/center]\n[hr]\n[quote=Creator]Tested on v4[/quote]\n[code=lua][b]verbatim[/b][/code]\n[spoiler=Notes]Hidden[/spoiler]",
    );

    expect(ast.map((n) => n.type)).toEqual([
      "heading",
      "br",
      "align",
      "br",
      "hr",
      "br",
      "quote",
      "br",
      "code",
      "br",
      "spoiler",
    ]);

    const codeNode = ast.find((n) => n.type === "code");
    expect(codeNode).toEqual({
      type: "code",
      language: "lua",
      content: "[b]verbatim[/b]",
    });
  });

  it("supports unordered, ordered, and nested bullet lists", () => {
    const ast = parseBbcode(
      "[list]\n[*][b]Parent feature[/b]\n[list]\n[*]Nested point A\n[*]Nested point B\n[/list]\n[*]Second feature\n[/list]",
    );

    expect(ast).toHaveLength(1);
    const rootList = ast[0];
    expect(rootList?.type).toBe("list");
    if (rootList?.type === "list") {
      expect(rootList.ordered).toBe(false);
      expect(rootList.items).toHaveLength(2);
      const firstItem = rootList.items[0] ?? [];
      const nestedList = firstItem.find((node) => node.type === "list");
      expect(nestedList?.type).toBe("list");
      if (nestedList?.type === "list") {
        expect(nestedList.items).toHaveLength(2);
      }
    }

    const ordered = parseBbcode("[list=1][*]One[*]Two[/list]");
    expect(ordered[0]).toMatchObject({ type: "list", ordered: true });
  });

  it("blocks javascript:/data: URLs in [url] and [img] tags and preserves HTTP(S)", () => {
    const safeLink = parseBbcode("[url=https://kdilgames.com]Store[/url]");
    expect(safeLink).toEqual([
      {
        type: "url",
        href: "https://kdilgames.com/",
        children: [{ type: "text", text: "Store" }],
      },
    ]);

    const evilLink = parseBbcode("[url=javascript:alert(1)]Click[/url]");
    expect(evilLink.some((n) => n.type === "url")).toBe(false);

    const evilImg = parseBbcode("[img]data:text/html,<script>alert(1)</script>[/img]");
    expect(evilImg.some((n) => n.type === "img")).toBe(false);

    const safeImg = parseBbcode("[img=Banner]https://cdn.example.com/banner.png[/img]");
    expect(safeImg).toEqual([
      {
        type: "img",
        src: "https://cdn.example.com/banner.png",
        alt: "Banner",
      },
    ]);
  });

  it("validates colors and sizes against strict safe allowlists", () => {
    expect(sanitizeBbColor("#1d4ed8")).toBe("#1d4ed8");
    expect(sanitizeBbColor("emerald")).toBe("emerald");
    expect(sanitizeBbColor("red; background:url(x)")).toBeNull();

    expect(normalizeBbSize("5")).toBe("xl");
    expect(normalizeBbSize("16px")).toBe("lg");
    expect(normalizeBbSize("expression(alert(1))")).toBeNull();
  });

  it("handles unclosed or mismatched tags gracefully without throwing", () => {
    const ast = parseBbcode("Hello [b]unclosed and [/i] stray [unknown] bracket");
    expect(ast.length).toBeGreaterThan(0);
  });

  it("strips BBCode formatting cleanly for excerpts and notifications", () => {
    expect(
      stripBbcode("[update-title]v4.0[/update-title]\n[h2]New Features[/h2][list][*][b]Fast[/b] engine[/list]"),
    ).toBe("New Features • Fast engine");
  });
});
