"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeftIcon, CornerDownRightIcon, NetworkIcon } from "lucide-react";
import { CopyAction } from "../account/copy-action";
import { crossLinkClass, LookupError, LookupForm, useLookup } from "./lookup";

interface ResolvedAddress {
  address: string;
  ttl: number;
  public: boolean;
}

interface Lookup {
  hostname: string;
  aliasOf: string | null;
  ipv4: ResolvedAddress[];
  ipv6: ResolvedAddress[];
}

const EXAMPLES = ["google.com", "cloudflare.com", "whatsapp.net"].map((v) => ({ label: v, value: v }));

/** "3600" → "1 h", "300" → "5 min", "45" → "45 s". */
function formatTtl(seconds: number) {
  if (seconds >= 86400 && seconds % 86400 === 0) return `${seconds / 86400} d`;
  if (seconds >= 3600) return `${Math.round(seconds / 360) / 10} h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds} s`;
}

function AddressList({ title, items }: { title: string; items: ResolvedAddress[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
        <span className="font-normal tabular-nums normal-case">
          {items.length} address{items.length === 1 ? "" : "es"}
        </span>
      </h3>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-muted/30">
        {items.map((a) => (
          <li key={a.address} className="flex min-h-12 items-center gap-1 py-1 pr-1 pl-4">
            <span className="min-w-0 flex-1 font-mono text-sm font-medium select-all [overflow-wrap:anywhere]">{a.address}</span>
            {a.public ? null : <span className="mr-1 shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-strong">Private</span>}
            <span className="mr-1 hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline" title="How long DNS answers may be cached">
              TTL {formatTtl(a.ttl)}
            </span>
            {a.public ? (
              <Link href={`/tools/ip-to-hostname?ip=${encodeURIComponent(a.address)}`} aria-label={`Find the hostname of ${a.address}`} title="Find its hostname" className={crossLinkClass}>
                <ArrowRightLeftIcon aria-hidden />
              </Link>
            ) : null}
            <CopyAction value={a.address} label={`Copy ${a.address}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The "Hostname to IP" form and result: a hostname (or a pasted link) in, its IPv4 and IPv6 addresses
 * out, each with a copy button and a link to look its own hostname up. Shareable as ?host=.
 */
export function HostnameToIp({ initialHost }: { initialHost: string }) {
  const [value, setValue] = useState(initialHost);
  const { state, run } = useLookup<Lookup>({
    endpoint: "/api/public/tools/hostname-ip",
    field: "hostname",
    param: "host",
    shareKey: "hostname",
    initial: initialHost,
    emptyMessage: "Enter a hostname such as example.com.",
  });
  const result = state.phase === "done" ? state.result : null;
  const all = result ? [...result.ipv4, ...result.ipv6].map((a) => a.address) : [];

  return (
    <div className="grid gap-5">
      <LookupForm
        id="hostname"
        label="Hostname or link"
        value={value}
        onValueChange={setValue}
        onSubmit={(v) => void run(v)}
        loading={state.phase === "loading"}
        placeholder="example.com"
        buttonLabel="Get IP address"
        examples={EXAMPLES}
      />

      <div aria-live="polite" className="contents">
        {state.phase === "error" ? (
          <LookupError message={state.message}>
            {state.code === "ALREADY_IP" ? (
              <Link href={`/tools/ip-to-hostname?ip=${encodeURIComponent(value.trim())}`} className="font-semibold underline underline-offset-2">
                Find its hostname instead
              </Link>
            ) : null}
          </LookupError>
        ) : null}

        {result ? (
          <section aria-label="Result" className="grid gap-5 rounded-3xl border bg-card p-5 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 sm:p-6 motion-reduce:animate-none">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <NetworkIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-base font-semibold [overflow-wrap:anywhere]">{result.hostname}</p>
                <p className="text-sm text-muted-foreground">
                  {all.length} IP address{all.length === 1 ? "" : "es"} found
                </p>
                {result.aliasOf ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CornerDownRightIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      Alias of <span className="font-mono text-foreground">{result.aliasOf}</span>
                    </span>
                  </p>
                ) : null}
              </div>
              {all.length > 1 ? (
                <CopyAction value={all.join("\n")} label="Copy all addresses" variant="outline" size="sm" className="shrink-0 rounded-full">
                  Copy all
                </CopyAction>
              ) : null}
            </div>
            <AddressList title="IPv4" items={result.ipv4} />
            <AddressList title="IPv6" items={result.ipv6} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
