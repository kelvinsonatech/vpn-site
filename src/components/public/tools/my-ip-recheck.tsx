"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reads the address again (say, after connecting a tunnel): the page re-renders on the server with the
 * new request. The button stays focusable while checking (aria-disabled, not disabled) and a polite
 * status line says how it went, including when the address hasn't changed.
 */
export function RecheckButton({ ip }: { ip: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The address when the last check started; the outcome is read once the refresh has finished.
  const [checkedFrom, setCheckedFrom] = useState<string | null>(null);
  const outcome =
    pending || checkedFrom === null ? "" : checkedFrom === ip ? `Checked again. Your IP address is still ${ip}.` : `Your IP address is now ${ip}.`;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="rounded-full aria-disabled:cursor-progress aria-disabled:opacity-60"
        aria-disabled={pending || undefined}
        onClick={() => {
          if (pending) return;
          setCheckedFrom(ip);
          startTransition(() => router.refresh());
        }}
      >
        <RefreshCwIcon className={pending ? "animate-spin motion-reduce:animate-none" : undefined} aria-hidden />
        {pending ? "Checking…" : "Check again"}
      </Button>
      <span role="status" aria-atomic="true" className="sr-only">
        {outcome}
      </span>
    </>
  );
}
