// The landing page (site/index.html) and the editor page (index.html) carry the same pitch,
// share image and favicon for search engines, link previews and tabs. They are copied by hand:
// keep them equal.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pages = { landing: read("../../site/index.html"), editor: read("../index.html") };

function tag(html, attribute, name) {
  const match = html.match(new RegExp(`<meta\\s+${attribute}="${name}"\\s+content="([^"]*)"`));
  return match?.[1];
}

describe("search and sharing tags", () => {
  for (const [attribute, name] of [
    ["name", "description"],
    ["property", "og:description"],
    ["property", "og:image"],
    ["property", "og:image:alt"],
    ["name", "twitter:description"],
    ["name", "twitter:image"],
    ["name", "twitter:image:alt"],
  ]) {
    it(`are the same on both pages: ${name}`, () => {
      expect(tag(pages.landing, attribute, name)).toBeTruthy();
      expect(tag(pages.editor, attribute, name)).toBe(tag(pages.landing, attribute, name));
    });
  }

  it("show the landing page's favicon on the editor page too", () => {
    // The editor inlines it: the single-file build cannot link to a separate icon file.
    const inline = pages.editor.match(
      /<link[^>]*rel="icon"[^>]*href="data:image\/svg\+xml,([^"]*)"/,
    );
    const svg = decodeURIComponent(inline[1]).replaceAll("'", '"');
    expect(svg).toBe(read("../../site/favicon.svg").trim());
  });

  it("use the same text for the description and its Open Graph copy", () => {
    expect(tag(pages.landing, "property", "og:description")).toBe(
      tag(pages.landing, "name", "description"),
    );
  });
});
