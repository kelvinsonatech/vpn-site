"use client";

import { useEffect } from "react";
import { useNow } from "@/components/public/live-time";
import type { SavedAccountServerStatus, SavedAccountStatusResponse, SavedAccountSummary } from "@/lib/public/types";
import { requestJson } from "./api";
import { applySavedStatuses, useSavedAccounts } from "./saved-accounts";

/** At most one lookup per this long, however often pages load or the tab comes back into view. */
const MIN_GAP_MS = 60_000;
const LAST_KEY = "vl:my-accounts-checked";

/** When the last lookup started, shared by every page load in this tab. */
function lastLookup(): number {
  try {
    return Number(window.sessionStorage.getItem(LAST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markLookup(at: number) {
  try {
    window.sessionStorage.setItem(LAST_KEY, String(at));
  } catch {
    // Private mode: the throttle then only lasts for this page.
  }
}

/**
 * Asks the website what became of the saved accounts that are still running by their expiry date:
 * removed by the server before they expired, or blocked by it for now (e.g. banned by its
 * multi-login limiter), and records that in the saved list, so every "My accounts" view (page,
 * header, mobile menu) shows it. Asked when a page opens and when the tab comes back into view, at
 * most once a minute per tab. Without an answer the list simply falls back to what it knew.
 */
export function useRefreshSavedStatuses(accounts: readonly SavedAccountSummary[] | null, now: number | null): void {
  const key =
    accounts && now !== null
      ? accounts
          .filter((a) => !a.removedAt && Date.parse(a.expiresAt) > now)
          .map((a) => a.id)
          .sort()
          .join(",")
      : "";

  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    let controller: AbortController | null = null;
    let last = lastLookup();
    const load = () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      markLookup(last);
      controller?.abort();
      controller = new AbortController();
      requestJson<SavedAccountStatusResponse>("/api/public/accounts/status", { method: "POST", body: { ids }, signal: controller.signal })
        .then(({ data }) => {
          const statuses = new Map<string, SavedAccountServerStatus>(Object.entries(data?.accounts ?? {}));
          if (statuses.size) applySavedStatuses(statuses);
        })
        .catch(() => {
          // Network error, rate limit, server error: try again the next time the tab is shown.
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      controller?.abort();
    };
  }, [key]);
}

/** Mounted once in the public layout, so every page (and its header and mobile menus) stays current. */
export function SavedStatusRefresher() {
  useRefreshSavedStatuses(useSavedAccounts(), useNow());
  return null;
}
