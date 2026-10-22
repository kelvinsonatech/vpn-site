"use client";

import { useEffect } from "react";
import type { SavedAccountServerStatus, SavedAccountStatusResponse, SavedAccountSummary } from "@/lib/public/types";
import { requestJson } from "./api";
import { applySavedStatuses } from "./saved-accounts";

/** At most one lookup per this long, however often the tab comes back into view. */
const MIN_GAP_MS = 60_000;

/**
 * Asks the website what became of the saved accounts that are still running by their expiry date:
 * removed by the server before they expired, or blocked by it for now (e.g. banned by its
 * multi-login limiter), and records that in the saved list, so every "My accounts" view (page,
 * header, mobile menu) shows it. Asked when the list opens and when the tab comes back into view.
 * Without an answer the list simply falls back to what it knew.
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
