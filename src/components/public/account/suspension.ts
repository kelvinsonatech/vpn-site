import type { AccountSuspension, SavedAccountSummary, SuspensionReason } from "@/lib/public/types";

/** How a server block of an account is shown to visitors (My accounts page, header and mobile menus). */
export const SUSPENSION: Record<SuspensionReason, { badge: string; title: string; text: string }> = {
  multi_login: {
    badge: "Banned",
    title: "Banned for multi-login",
    text: "The server banned this account for being used on more devices at once than allowed.",
  },
  disabled: {
    badge: "Blocked",
    title: "Blocked by the server",
    text: "The server has blocked this account for now.",
  },
  expired: {
    badge: "Expired",
    title: "Expired on the server",
    text: "The server says this account has already expired, before the time shown here.",
  },
};

/**
 * The server block still in force for a saved account: none once its known end has passed (the
 * website is asked again and clears it for good when the server confirms).
 */
export function currentSuspension(a: SavedAccountSummary, now: number | null): AccountSuspension | null {
  const s = a.suspended;
  if (!s) return null;
  return s.until && now !== null && Date.parse(s.until) <= now ? null : s;
}
