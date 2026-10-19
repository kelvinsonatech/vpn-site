"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Reads the address again (say, after connecting a tunnel): the page re-renders on the server with the new request. */
export function RecheckButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="outline" className="rounded-full" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      <RefreshCwIcon className={pending ? "animate-spin motion-reduce:animate-none" : undefined} aria-hidden />
      {pending ? "Checking…" : "Check again"}
    </Button>
  );
}
