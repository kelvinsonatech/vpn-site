/**
 * Locked account durations (Admin → Settings → Durations). Pure helpers shared by the catalogue, the
 * create form and the server-side check, so they agree on what a visitor may choose. Client-safe.
 */

/** The protocol's durations a visitor can choose: its options minus the locked ones, ascending. */
export function openDurations(options: readonly number[], locked: readonly number[]): number[] {
  return [...new Set(options)].filter((d) => !locked.includes(d)).sort((a, b) => a - b);
}

/** The duration to start on: the protocol default if it is open, else the shortest open one; undefined when none is open. */
export function effectiveDefaultDuration(options: readonly number[], defaultDays: number, locked: readonly number[]): number | undefined {
  const open = openDurations(options, locked);
  return open.includes(defaultDays) ? defaultDays : open[0];
}
