"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeftIcon, BadgeCheckIcon, GlobeIcon } from "lucide-react";
import { CopyAction } from "../account/copy-action";
import { crossLinkClass, LookupError, LookupForm, useLookup } from "./lookup";

interface ReverseLookup {
  ip: string;
  hostnames: { name: string; confirmed: boolean }[];
}

/**
 * The "IP to Hostname" form and result: an IP address in, its reverse DNS names out, each marked
 * "Verified" when it points back to the same IP, with a copy button and a link to look it up forwards.
 * `myIp` (the visitor's own public address) becomes a one-tap example. Shareable as ?ip=.
 */
export function IpToHostname({ initialIp, myIp }: { initialIp: string; myIp: string | null }) {
  const [value, setValue] = useState(initialIp);
  const { state, run } = useLookup<ReverseLookup>({
    endpoint: "/api/public/tools/ip-hostname",
    field: "ip",
    param: "ip",
    shareKey: "ip",
    initial: initialIp,
    emptyMessage: "Enter an IP address such as 8.8.8.8.",
  });
  const result = state.phase === "done" ? state.result : null;
  const examples = [...(myIp ? [{ label: `My IP (${myIp})`, value: myIp }] : []), { label: "8.8.8.8", value: "8.8.8.8" }, { label: "1.1.1.1", value: "1.1.1.1" }];

  return (
    <div className="grid gap-5">
      <LookupForm
        id="ip"
        label="IP address"
        value={value}
        onValueChange={setValue}
        onSubmit={(v) => void run(v)}
        loading={state.phase === "loading"}
        placeholder="8.8.8.8"
        buttonLabel="Get hostname"
        examples={examples}
      />

      <div aria-live="polite" className="contents">
        {state.phase === "error" ? (
          <LookupError message={state.message}>
            {state.code === "IS_HOSTNAME" ? (
              <Link href={`/tools/hostname-to-ip?host=${encodeURIComponent(value.trim())}`} className="font-semibold underline underline-offset-2">
                Look it up there
              </Link>
            ) : null}
          </LookupError>
        ) : null}

        {result ? (
          <section aria-label="Result" className="grid gap-5 rounded-3xl border bg-card p-5 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 sm:p-6 motion-reduce:animate-none">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <GlobeIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-base font-semibold [overflow-wrap:anywhere]">{result.ip}</p>
                <p className="text-sm text-muted-foreground">
                  {result.hostnames.length} hostname{result.hostnames.length === 1 ? "" : "s"} found
                </p>
              </div>
            </div>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-muted/30">
              {result.hostnames.map((h) => (
                <li key={h.name} className="flex min-h-12 items-center gap-1 py-1 pr-1 pl-4">
                  <span className="min-w-0 flex-1 font-mono text-sm font-medium select-all [overflow-wrap:anywhere]">{h.name}</span>
                  {h.confirmed ? (
                    <span
                      className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success"
                      title="This hostname points back to the same IP address"
                    >
                      <BadgeCheckIcon className="size-3" aria-hidden />
                      Verified
                    </span>
                  ) : null}
                  <Link href={`/tools/hostname-to-ip?host=${encodeURIComponent(h.name)}`} aria-label={`Find the IP addresses of ${h.name}`} title="Find its IP addresses" className={crossLinkClass}>
                    <ArrowRightLeftIcon aria-hidden />
                  </Link>
                  <CopyAction value={h.name} label={`Copy ${h.name}`} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
