"use client";

import { useEffect } from "react";
import type { SavedAccountStatusResponse, SavedAccountSummary } from "@/lib/public/types";
import { requestJson } from "./api";
import { markSavedAccountsRemoved } from "./saved-accounts";

/** At most one lookup per this long, however often the tab comes back into view. */
const MIN_GAP_MS = 60_000;

/**
 * Asks the website which saved accounts the server removed before they expired (e.g. its
 * multi-login limiter) and records that in the saved list, so every "My accounts" view (page,
 * header, mobile menu) shows them as removed. Only accounts that are still running by the expiry date
 * and not yet known to be removed are asked about, when the list opens and when the tab comes back
 * into view. Without an answer the list simply falls back to the expiry dates.
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
    let last = 0;
    const load = () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      controller?.abort();
      controller = new AbortController();
      requestJson<SavedAccountStatusResponse>("/api/public/accounts/status", { method: "POST", body: { ids }, signal: controller.signal })
        .then(({ data }) => {
          const removals = new Map<string, string>();
          for (const [id, s] of Object.entries(data?.accounts ?? {})) {
            if (s?.status === "removed") removals.set(id, s.removedAt ?? new Date().toISOString());
          }
          if (removals.size) markSavedAccountsRemoved(removals);
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
