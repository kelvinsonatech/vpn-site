import type { StaticImageData } from "next/image";

/**
 * Cover photo of each guide, from Pexels (free for commercial use under the Pexels licence, no
 * attribution required; the article still credits the photographer). Two sizes, cropped to 16:9.
 */
export interface GuideCover {
  /** 1600×900: article photo and share preview. */
  full: StaticImageData;
  /** 800×450: guide cards. */
  card: StaticImageData;
  /** What the photo shows: the article photo's alt text (cards are labelled by the guide title). */
  alt: string;
  /** Credited under the article photo ("" = credit Pexels only). */
  photographer: string;
  /** The photo's page on Pexels. */
  href: string;
}

// Filled in with the chosen photos; until then cards show a plain gradient and articles no photo.
const COVERS: Record<string, GuideCover> = {};

export function guideCover(slug: string): GuideCover | undefined {
  return COVERS[slug];
}
