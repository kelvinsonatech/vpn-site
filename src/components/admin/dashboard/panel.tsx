import { cn } from "@/lib/utils";

/** A dashboard section: a large rounded white card with a bold title, optional subtitle and action. */
export function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col rounded-[1.75rem] bg-card p-5 text-card-foreground shadow-[0_10px_30px_-18px_rgb(15_23_42/0.18)] ring-1 ring-black/[0.04] sm:p-6 dark:ring-white/10", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** The small pill link in a panel's corner ("See all"). */
export const panelLinkClass =
  "inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3.5 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/50";
