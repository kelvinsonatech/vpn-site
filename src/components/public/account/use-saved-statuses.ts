"use client";

import { useEffect, useState } from "react";
import type { SavedAccountServerStatus, SavedAccountStatusResponse } from "@/lib/public/types";
import { requestJson } from "./api";

/** At most one lookup per this long, however often the tab comes back into view. */
const MIN_GAP_MS = 60_000;

/**
 * What the website knows about the accounts saved on this device (removed early by the server,
 * expired, still active). Asked when the list opens and when the tab comes back into view. Until
 * an answer arrives, or when the website cannot be reached, the map is empty and the list falls back
 * to the expiry dates.
 */
export function useSavedStatuses(ids: readonly string[] | null): ReadonlyMap<string, SavedAccountServerStatus> {
  const [statuses, setStatuses] = useState<ReadonlyMap<string, SavedAccountServerStatus>>(new Map());
  const key = ids ? [...ids].sort().join(",") : "";

  useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    let controller: AbortController | null = null;
    let last = 0;
    const load = () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      controller?.abort();
      controller = new AbortController();
      requestJson<SavedAccountStatusResponse>("/api/public/accounts/status", { method: "POST", body: { ids: list }, signal: controller.signal })
        .then(({ data }) => {
          if (data && typeof data.accounts === "object") setStatuses(new Map(Object.entries(data.accounts)));
        })
        .catch(() => {
          last = 0; // try again next time the tab is shown
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

  return statuses;
}
