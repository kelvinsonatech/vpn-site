/** A small ring showing a share (0-100%): a primary arc on a muted track, the number in the middle. */
export function PercentRing({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 20;
  const circumference = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex size-14 shrink-0 items-center justify-center" role="img" aria-label={label ?? `${pct}%`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        {pct > 0 ? (
          <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-primary" strokeDasharray={`${(pct / 100) * circumference} ${circumference}`} />
        ) : null}
      </svg>
      <span className="text-[11px] font-bold tabular-nums" aria-hidden>
        {pct}%
      </span>
    </span>
  );
}
