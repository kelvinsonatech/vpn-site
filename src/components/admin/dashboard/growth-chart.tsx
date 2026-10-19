import { formatNumber } from "@/lib/format";

/** 1, 2 or 5 × a power of ten, at least `n`: tidy axis steps. */
function niceStep(n: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(n, 1)));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= n) ?? 10 * pow;
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Accounts created per day: rounded bars over dashed gridlines with a tidy y axis. Each bar shows
 * its count on hover; screen readers get the numbers as a list. Every third day is labelled,
 * counting back from today so "Today" always has room.
 */
export function GrowthChart({ data }: { data: { day: string; count: number }[] }) {
  const step = niceStep(Math.max(...data.map((d) => d.count), 4) / 4);
  const max = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const pct = (n: number) => `${(n / max) * 100}%`;
  const label = (day: string, i: number) => (i === data.length - 1 ? "Today" : DAY.format(new Date(`${day}T00:00:00Z`)));
  return (
    <figure className="grid grid-cols-[auto_1fr] gap-x-3">
      <div className="relative h-56 w-8" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 translate-y-1/2 text-[11px] leading-none text-muted-foreground tabular-nums" style={{ bottom: pct(t) }}>
            {formatNumber(t)}
          </span>
        ))}
      </div>
      <div className="relative h-56">
        {ticks.map((t) => (
          <span key={t} aria-hidden className={`absolute inset-x-0 border-t ${t ? "border-dashed border-border/70" : "border-border"}`} style={{ bottom: pct(t) }} />
        ))}
        <ol className="relative flex h-full items-end gap-1.5 sm:gap-2.5" aria-label="Accounts created per day">
          {data.map((d, i) => (
            <li key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
              <span className="sr-only">
                {label(d.day, i)}: {d.count}
              </span>
              <span
                aria-hidden
                title={`${label(d.day, i)}: ${formatNumber(d.count)} account${d.count === 1 ? "" : "s"}`}
                className={`w-full max-w-5 rounded-full transition-[filter] group-hover:brightness-110 ${d.count ? (i === data.length - 1 ? "bg-primary forced-colors:bg-[Highlight]" : "bg-primary/80 forced-colors:bg-[CanvasText]") : "bg-muted forced-colors:bg-[GrayText]"}`}
                style={{ height: d.count ? `max(${pct(d.count)}, 0.5rem)` : "0.5rem" }}
              />
              {d.count ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ bottom: `calc(${pct(d.count)} + 0.35rem)` }}
                >
                  {formatNumber(d.count)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <span aria-hidden />
      {/* Labels are centred on their bar even when wider than it (phones), so each sits under the day it names. */}
      <div className="mt-2.5 flex h-3 gap-1.5 text-[11px] leading-none text-muted-foreground sm:gap-2.5" aria-hidden>
        {data.map((d, i) => (
          <span key={d.day} className="relative flex-1">
            {(data.length - 1 - i) % 3 === 0 ? <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{label(d.day, i)}</span> : null}
          </span>
        ))}
      </div>
    </figure>
  );
}
