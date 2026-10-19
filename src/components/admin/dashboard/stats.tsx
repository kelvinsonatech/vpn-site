import Link from "next/link";
import { cn } from "@/lib/utils";

const TONES = {
  violet: "from-violet-200/80 via-violet-100/70 to-fuchsia-50 dark:from-violet-500/25 dark:via-violet-500/15 dark:to-fuchsia-500/10",
  blue: "from-sky-200/80 via-blue-100/70 to-indigo-50 dark:from-sky-500/25 dark:via-blue-500/15 dark:to-indigo-500/10",
  mint: "from-emerald-200/80 via-emerald-100/70 to-teal-50 dark:from-emerald-500/25 dark:via-emerald-500/15 dark:to-teal-500/10",
  aqua: "from-cyan-200/80 via-cyan-100/70 to-sky-50 dark:from-cyan-500/25 dark:via-cyan-500/15 dark:to-sky-500/10",
} as const;

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
        "relative h-full overflow-hidden rounded-[1.75rem] bg-gradient-to-br px-5 py-5 shadow-[0_10px_30px_-18px_rgb(15_23_42/0.25)] ring-1 ring-black/[0.04] transition-transform duration-200 dark:ring-white/10",
        TONES[tone],
        href && "group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0",
      )}
    >
      <p className="flex items-center gap-2.5 text-sm font-semibold">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/80 text-foreground shadow-sm dark:bg-white/10 [&_svg]:size-4">{icon}</span>
        {label}
      </p>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1.5 text-sm text-foreground/70">{hint}</p> : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="group rounded-[1.75rem] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden">
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
export function MiniStat({ label, value, hint, icon, tone = "default" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon: React.ReactNode; tone?: keyof typeof CHIP_TONES }) {
  return (
    <div className="flex items-center gap-3 rounded-[1.5rem] bg-card px-3.5 py-3.5 sm:gap-3.5 sm:px-4 shadow-[0_10px_30px_-20px_rgb(15_23_42/0.2)] ring-1 ring-black/[0.04] dark:ring-white/10">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl sm:size-11 [&_svg]:size-5", CHIP_TONES[tone])}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xl leading-tight font-bold tracking-tight tabular-nums">{value}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </div>
  );
}
