/** Escape `%`, `_` and `\` so user text matches literally in LIKE / ILIKE patterns (backslash is the default escape). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
