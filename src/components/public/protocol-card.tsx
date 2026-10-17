import Link from "next/link";
import { ArrowRightIcon, CircleCheckIcon, ClockIcon } from "lucide-react";
import { ProtocolIcon } from "@/components/protocol-icon";
import { guideFor } from "@/lib/protocol-guides";
import { isImageProtocolIcon } from "@/lib/protocol-icons";
import { cn } from "@/lib/utils";
import type { PublicProtocolSummary } from "@/lib/public/types";
import { FlagStack } from "./flag-stack";
import { formatDayRange, plural } from "./format";
import { categoryLabel } from "./nav";

/**
 * Home page protocol card: category and server-count badges, icon medallion, name, three
 * highlights, flags of its countries, availability and a full-width "Create account" button.
 */
export function ProtocolCard({ protocol: p, className, style }: { protocol: PublicProtocolSummary; className?: string; style?: React.CSSProperties }) {
  const guide = guideFor(p.slug, p.name);
  const available = p.availableCount > 0;
  const tone = `var(--tone-${p.category}, var(--primary))`;
  const imageIcon = isImageProtocolIcon(p.icon);
  return (
    <article
      style={{ ...style, "--tone": tone } as React.CSSProperties}
      className={cn(
        "group relative isolate flex flex-col overflow-hidden rounded-[1.75rem] border bg-card p-5 pt-6 shadow-[0_1px_2px_rgb(15_30_90/0.05),0_12px_32px_-18px_rgb(15_30_120/0.25)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[color-mix(in_oklch,var(--tone)_40%,transparent)] hover:shadow-[0_24px_48px_-20px_color-mix(in_oklch,var(--tone)_45%,transparent)] sm:p-6 motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[var(--tone)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(80%_100%_at_50%_0%,color-mix(in_oklch,var(--tone)_16%,transparent),transparent)] opacity-70 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-[color-mix(in_oklch,var(--tone)_12%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--tone)]">{categoryLabel(p.category)}</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm tabular-nums",
            p.serverCount > 0 ? "bg-[var(--tone)] text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {plural(p.serverCount, "Server")}
        </span>
      </div>

      <div className="mt-5 text-center">
        <span
          className={cn(
            "mx-auto flex size-16 items-center justify-center rounded-2xl rotate-3 shadow-lg ring-8 ring-[color-mix(in_oklch,var(--tone)_10%,transparent)] group-hover:rotate-0 transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100",
            // A picture icon is the tile itself; a line icon sits on the protocol's colour.
            imageIcon ? "shadow-black/15" : "bg-[var(--tone)] shadow-[color-mix(in_oklch,var(--tone)_35%,transparent)]",
          )}
        >
          <ProtocolIcon name={p.icon} className={imageIcon ? "size-full rounded-2xl" : "size-7 -rotate-3 text-white group-hover:rotate-0"} />
        </span>
        <h3 className="mt-5 text-xl font-bold tracking-tight">
          {/* Stretched link: the whole card is clickable. z-10 keeps it above hover effects (transforms and
              filters lift the decorative "Create account" button and arrow above it otherwise). */}
          <Link href={p.href} className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-3xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {p.name}
          </Link>
        </h3>
        <p className="mx-auto mt-1.5 line-clamp-2 max-w-xs text-sm text-muted-foreground">{p.description}</p>
      </div>

      <ul className="mt-5 space-y-2.5 text-sm">
        {guide.highlights.slice(0, 3).map((h) => (
          <li key={h} className="flex items-start gap-2.5">
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-[var(--tone)]" aria-hidden />
            <span className="text-muted-foreground">{h}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <div className="mb-4 flex min-h-6 border-t border-dashed pt-4 items-center justify-between gap-3 text-xs">
          <FlagStack countries={p.countries} max={4} />
          <span className="flex items-center gap-3 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5" aria-hidden />
              {formatDayRange(p.durationOptions)}
            </span>
            <span className={cn("inline-flex items-center gap-1.5 font-medium", available ? "text-success" : "text-muted-foreground")}>
              <span className={cn("size-1.5 rounded-full", available ? "bg-success" : "bg-muted-foreground/50")} />
              {p.availableCount}/{p.serverCount} open
            </span>
          </span>
        </div>
        <span
          aria-hidden
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--tone)] text-sm font-semibold text-white shadow-md shadow-[color-mix(in_oklch,var(--tone)_30%,transparent)] transition-[filter,box-shadow] duration-300 group-hover:brightness-110 group-hover:shadow-lg"
        >
          Create account
          <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
