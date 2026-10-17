/**
 * One "Label  value  [actions]" line of an account details block (the result card and the
 * My accounts details). Values are monospace and wrap anywhere; `children` can be rich content.
 */
export function DetailRow({ label, children, actions }: { label: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <li className="grid min-h-10 grid-cols-[5.25rem_minmax(0,1fr)_auto] items-center gap-x-2 py-0.5 pr-1 pl-3 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto] sm:pl-3.5">
      <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
      <span className="min-w-0 py-1.5 font-mono text-[13px] whitespace-pre-wrap [overflow-wrap:anywhere] sm:text-sm">{children}</span>
      <span className="flex shrink-0 items-center gap-0.5">{actions}</span>
    </li>
  );
}
