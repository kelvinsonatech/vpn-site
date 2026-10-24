import Link from "next/link";
import { ArrowRightIcon, ClockIcon } from "lucide-react";
import { readingMinutes } from "@/lib/guides";
import type { GuideCover } from "@/lib/guides/covers";
import type { GuideArticle } from "@/lib/guides/types";
import { cn } from "@/lib/utils";
import { CardPointerFx } from "./card-pointer-fx";

/** Column of a card in its row (0-2): staggers the scroll-in animation (.vl-reveal). */
const STAGGER = ["[--vl-i:0]", "[--vl-i:1]", "[--vl-i:2]"];

/**
 * Guide card with its cover photo: lifts and tilts toward the pointer, the photo zooms and a light
 * sweeps across it on hover. Render inside an <li> given `revealClass(column)` so it also rises
 * into view while scrolling. `compact` is the smaller card for "Related guides".
 */
export function GuideCard({ guide, cover, compact = false }: { guide: GuideArticle; cover?: GuideCover; compact?: boolean }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="vl-guide-card group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-sm outline-none hover:-translate-y-2 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/15 focus-visible:-translate-y-2 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <CardPointerFx />
      <span className={cn("relative block overflow-hidden bg-muted", compact ? "aspect-[2/1]" : "aspect-[16/9]")}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- bundled picture, two sizes
          <img
            src={cover.card.src}
            srcSet={`${cover.card.src} ${cover.card.width}w, ${cover.full.src} ${cover.full.width}w`}
            sizes={compact ? "(min-width: 640px) 420px, 100vw" : "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"}
            width={cover.card.width}
            height={cover.card.height}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover transition-[scale,filter] duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:saturate-[1.15] group-focus-visible:scale-110"
          />
        ) : (
          <span aria-hidden className="block size-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
        )}
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        />
        <span aria-hidden className="vl-guide-shine" />
        <span className="absolute top-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide text-white uppercase backdrop-blur-md">
          {guide.category}
        </span>
      </span>
      <span className={cn("flex flex-1 flex-col", compact ? "p-4 sm:p-5" : "p-5 sm:p-6")}>
        <span className={cn("font-bold tracking-tight text-balance transition-colors group-hover:text-primary", compact ? "text-base" : "text-lg")}>
          {guide.title}
        </span>
        <span className={cn("mt-2 flex-1 text-sm text-muted-foreground", compact && "line-clamp-2")}>{guide.description}</span>
        <span className="mt-5 flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <ClockIcon className="size-4" aria-hidden />
            {readingMinutes(guide)} min read
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
            Read
            <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden />
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Classes for the <li> around a GuideCard: scroll-in animation, staggered by column. */
export function revealClass(column: number) {
  return cn("vl-reveal", STAGGER[column % STAGGER.length]);
}
