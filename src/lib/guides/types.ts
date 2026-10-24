/**
 * Guides (/guides): original help articles. Each article is a typed data file in ./articles, so it is
 * checked like code and rendered by one component (no HTML or markdown in the data).
 *
 * Text fields support two inline marks only: **bold** and [label](/internal/path) links (site paths
 * starting with "/", e.g. /ssh or /guides/fix-connection-problems).
 */
export type GuideCategory = "Getting started" | "Apps" | "Protocols" | "Troubleshooting" | "Privacy & fair use";

export type GuideBlock =
  | { type: "p"; text: string }
  /** Bulleted list. */
  | { type: "ul"; items: string[] }
  /** Numbered steps. */
  | { type: "steps"; items: string[] }
  /** Highlighted hint box. */
  | { type: "tip"; text: string }
  /** Highlighted caution box. */
  | { type: "note"; text: string }
  /** Two-column comparison: first row is the header. */
  | { type: "table"; rows: string[][] };

export interface GuideSection {
  heading: string;
  blocks: GuideBlock[];
}

export interface GuideArticle {
  /** URL segment: lowercase words joined by "-". */
  slug: string;
  /** Page title (H1), at most 70 characters. */
  title: string;
  /** Meta description and card text, 120-160 characters. */
  description: string;
  category: GuideCategory;
  /** ISO date (YYYY-MM-DD) of the last content update. */
  updated: string;
  /** Opening paragraph(s) shown before the first section. */
  intro: string[];
  sections: GuideSection[];
  /** Short question/answer pairs shown at the end (optional). */
  faq?: { q: string; a: string }[];
  /** Slugs of other guides to suggest at the end. */
  related: string[];
  /**
   * Protocol slugs the article is about (e.g. "ssh", "vless"). The page offers "Create account" links
   * only for those currently listed on the site, so text never links to a protocol page directly.
   */
  protocols: string[];
}
