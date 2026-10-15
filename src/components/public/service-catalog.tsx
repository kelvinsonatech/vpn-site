"use client";

import { useMemo, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicProtocolSummary } from "@/lib/public/types";
import { categoryLabel } from "./nav";
import { ProtocolCard } from "./protocol-card";

/**
 * Homepage service catalogue: free-text search and category chips over the real protocol list.
 * Counts come straight from the props; nothing is invented when filters leave no results.
 */
export function ServiceCatalog({ protocols }: { protocols: PublicProtocolSummary[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of protocols) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return [...m];
  }, [protocols]);

  const q = query.trim().toLowerCase();
  const filtered = protocols.filter(
    (p) =>
      (!category || p.category === category) &&
      (!openOnly || p.availableCount > 0) &&
      (!q || `${p.name} ${p.description} ${p.category} ${p.countries.map((c) => c.name).join(" ")}`.toLowerCase().includes(q)),
  );
  const filtering = Boolean(q || category || openOnly);
  const clear = () => {
    setQuery("");
    setCategory(null);
    setOpenOnly(false);
  };

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
      active ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card text-foreground hover:border-primary/40",
    );

  return (
    <div>
      <div className="mb-8 rounded-[1.75rem] border bg-card/90 p-3 shadow-[0_16px_40px_-28px_rgb(15_30_120/0.4)] backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex flex-1 items-center">
            <span className="sr-only">Search services or countries</span>
            <SearchIcon className="pointer-events-none absolute left-4 size-4 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search protocol or country"
              className="h-12 w-full rounded-full border bg-background pr-4 pl-11 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
          </label>
          <label className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-full border bg-background px-4 text-sm font-medium select-none">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Open slots only
          </label>
        </div>
        <div role="group" aria-label="Filter by category" className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <button type="button" aria-pressed={!category} onClick={() => setCategory(null)} className={chip(!category)}>
            All <span className="tabular-nums opacity-70">{protocols.length}</span>
          </button>
          {categories.map(([c, n]) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)} className={chip(category === c)}>
              <span className="size-2 rounded-full" style={{ background: `var(--tone-${c}, var(--primary))` }} aria-hidden />
              {categoryLabel(c)} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex min-h-6 items-center justify-between gap-3 text-sm" aria-live="polite">
        <p className="text-muted-foreground">
          Showing <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span> of <span className="tabular-nums">{protocols.length}</span> services
        </p>
        {filtering ? (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            <XIcon className="size-3.5" /> Clear filters
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-primary/25 bg-card/70 px-6 py-12 text-center">
          <h3 className="text-lg font-semibold">No services match these filters</h3>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            {openOnly ? "None of the matching services has a free slot right now. Slots refill at the next reset." : "Try another word or category."}
          </p>
          <button type="button" onClick={clear} className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
            Show all services
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <ProtocolCard
              key={p.slug}
              protocol={p}
              className="animate-in duration-500 fade-in fill-mode-both slide-in-from-bottom-4"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
