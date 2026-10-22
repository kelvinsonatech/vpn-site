import type { SuspensionReason } from "@/lib/public/types";

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
