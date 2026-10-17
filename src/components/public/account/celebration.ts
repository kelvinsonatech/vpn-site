/**
 * The success celebration plays once per created account. A reload or a return to the page
 * recovers the same one-time result (use-account-creation.ts); this remembers which requests were
 * already celebrated in this tab (sessionStorage, like the recovery itself) so it doesn't replay.
 * Only request ids are stored, never account details.
 */

const STORAGE_KEY = "vl:celebrated";
const MAX_REMEMBERED = 20;
/** Fallback when storage is blocked (then a reload can't recover the result either). */
const seen = new Set<string>();

function read(storage: Storage | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * True the first time it is called for `requestId` in this tab (the caller then celebrates),
 * false on every later call.
 */
export function claimCelebration(requestId: string, storage: Storage | undefined = sessionStorageOrUndefined()): boolean {
  if (!requestId || seen.has(requestId)) return false;
  const ids = read(storage);
  seen.add(requestId);
  if (ids.includes(requestId)) return false;
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify([...ids, requestId].slice(-MAX_REMEMBERED)));
  } catch {
    // Storage full or blocked: the in-memory set still prevents replays on this page.
  }
  return true;
}

function sessionStorageOrUndefined(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
