import Link from "next/link";
import { cn } from "@/lib/utils";

// Even pastels from corner to corner (a fade to white reads milky), deeper tints in dark mode.
const TONES = {
  violet: "from-violet-200 to-violet-100 dark:from-violet-500/25 dark:to-violet-500/12",
  blue: "from-blue-200 to-sky-100 dark:from-blue-500/25 dark:to-sky-500/12",
  mint: "from-emerald-200 to-emerald-100 dark:from-emerald-500/25 dark:to-emerald-500/12",
  aqua: "from-cyan-200 to-cyan-100 dark:from-cyan-500/25 dark:to-cyan-500/12",
} as const;

/** The cards' light, crisp edge: a hairline highlight inside and a soft, short shadow under. */
export const cardSurface =
  "shadow-[0_1px_2px_rgb(15_23_42/0.05),0_8px_20px_-12px_rgb(15_23_42/0.22)] ring-1 ring-black/[0.04] dark:shadow-none dark:ring-white/10";

/** A headline number on a soft pastel gradient, with a white icon chip and label. */
export function GradientStat({
  label,
  value,
  hint,
  icon,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-[1.25rem] bg-gradient-to-br p-4 transition-transform duration-200 sm:px-5",
        cardSurface,
        TONES[tone],
        href && "group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0",
      )}
    >
      <p className="flex items-center gap-2.5 text-[13px] font-semibold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-foreground dark:bg-white/10 [&_svg]:size-3.5">
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-3 text-[1.75rem] leading-none font-bold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-2.5 text-[13px] text-foreground/70">{hint}</p> : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="group rounded-[1.25rem] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden">
      {body}
    </Link>
  );
}

const CHIP_TONES = {
  default: "bg-muted text-foreground",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-destructive",
  warning: "bg-warning-soft text-warning-strong",
} as const;

/** A compact white stat: coloured icon chip, the number, its label and an optional note under it. */
export function MiniStat({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone?: keyof typeof CHIP_TONES;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-[1.25rem] bg-card px-3.5 py-3 sm:px-4", cardSurface)}>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", CHIP_TONES[tone])}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-lg leading-tight font-bold tracking-tight tabular-nums">{value}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </div>
  );
}
