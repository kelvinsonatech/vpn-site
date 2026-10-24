import { describe, expect, it } from "vitest";
import { GUIDE_CATEGORIES, GUIDES, guideText, plainText, readingMinutes } from "@/lib/guides";
import { RESERVED_PROTOCOL_SLUGS } from "@/server/protocols/validation";

const PROTOCOLS = ["ssh", "ssh-ssl", "slowdns", "fastdns", "vmess", "vless", "trojan", "hysteria2", "zivpn"];
/** Pages that always exist (protocol pages only exist while a protocol is listed, so text never links them). */
const STATIC = [
  "/server-status",
  "/my-accounts",
  "/tools/my-ip",
  "/tools/hostname-to-ip",
  "/tools/ip-to-hostname",
  "/tools/v2ray-to-json",
  "/acceptable-use",
  "/privacy",
  "/terms",
  "/report",
  "/contact",
  "/about",
  "/#protocols",
  "/guides",
];
/** Wording an AdSense review can read as helping people get service they have not paid for. */
const FORBIDDEN = /free internet|bug ?host|zero[- ]?rat|whitelist|unlimited data|data bundle|bypass|unblock|\bhack|\bcrack|carrier billing|without paying/i;

const allText = (g: (typeof GUIDES)[number]) => [
  g.title,
  g.description,
  ...g.intro,
  ...g.sections.flatMap((s) => [s.heading, ...s.blocks.flatMap((b) => ("text" in b ? [b.text] : "rows" in b ? b.rows.flat() : b.items))]),
  ...(g.faq ?? []).flatMap((f) => [f.q, f.a]),
];

describe("guides", () => {
  it("have unique, well-formed slugs and a reserved /guides path", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(RESERVED_PROTOCOL_SLUGS).toContain("guides");
    expect(RESERVED_PROTOCOL_SLUGS).toContain("ads.txt");
  });

  for (const g of GUIDES) {
    describe(g.slug, () => {
      it("fits the page: title, description, category, dates, sections", () => {
        expect(g.title.length, "title").toBeLessThanOrEqual(70);
        expect(g.description.length, "description").toBeGreaterThanOrEqual(110);
        expect(g.description.length, "description").toBeLessThanOrEqual(170);
        expect(GUIDE_CATEGORIES).toContain(g.category);
        expect(g.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(g.intro.length).toBeGreaterThan(0);
        expect(g.sections.length).toBeGreaterThanOrEqual(3);
        for (const s of g.sections) expect(s.blocks.length, s.heading).toBeGreaterThan(0);
      });

      it("is substantial (at least 800 words)", () => {
        expect(guideText(g).split(/\s+/).length).toBeGreaterThanOrEqual(800);
        expect(readingMinutes(g)).toBeGreaterThanOrEqual(4);
      });

      it("links only to pages that always exist, and to other guides that exist", () => {
        for (const r of g.related) {
          expect(r).not.toBe(g.slug);
          expect(
            GUIDES.map((x) => x.slug),
            r,
          ).toContain(r);
        }
        for (const p of g.protocols) expect(PROTOCOLS).toContain(p);
        for (const text of allText(g)) {
          for (const m of text.matchAll(/\]\(([^)]*)\)/g)) {
            const path = m[1]!;
            const ok = STATIC.includes(path) || GUIDES.some((x) => path === `/guides/${x.slug}` || path.startsWith(`/guides/${x.slug}#`));
            expect(ok, `${g.slug}: link ${path}`).toBe(true);
          }
          // Marks are balanced: nothing left over once they are stripped.
          expect(plainText(text)).not.toMatch(/\*\*|\]\(/);
        }
      });

      it("uses no wording that reads as getting service without paying", () => {
        for (const text of allText(g)) expect(text, g.slug).not.toMatch(FORBIDDEN);
      });
    });
  }
});
