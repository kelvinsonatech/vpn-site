"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowRightLeftIcon, BadgeCheckIcon, GlobeIcon, InfoIcon } from "lucide-react";
import { countryName } from "@/lib/countries";
import { CopyAction } from "../account/copy-action";
import { Flag } from "../flag";
import { crossLinkClass, LookupError, LookupForm, useLookup } from "./lookup";

interface ReverseLookup {
  ip: string;
  websites: string[];
  hostnames: { name: string; confirmed: boolean }[];
  reverseDnsFailed: boolean;
  network: { asn: number; name: string; prefix: string; country: string | null } | null;
}

/** Lets a long hostname wrap after its dots ("ip-216-24-57-1.ingress." / "render.com") rather than mid-word. */
function breakAtDots(name: string) {
  return name.split(".").map((part, i) => (
    <Fragment key={i}>
      {i ? "." : null}
      {i ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

function ResultGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
        {count ? <span className="font-normal tabular-nums normal-case">{count}</span> : null}
      </h3>
      {children}
    </div>
  );
}

/** A hostname with an optional badge under it, a link to look it up forwards and a copy button. */
function NameRow({ name, children }: { name: string; children?: React.ReactNode }) {
  return (
    <li className="flex min-h-12 items-center gap-1 py-1 pr-1 pl-4">
      <span className="min-w-0 flex-1 py-1.5">
        <span className="block font-mono text-sm font-medium break-words select-all">{breakAtDots(name)}</span>
        {children}
      </span>
      <Link href={`/tools/hostname-to-ip?host=${encodeURIComponent(name)}`} aria-label={`Find the IP addresses of ${name}`} title="Find its IP addresses" className={crossLinkClass}>
        <ArrowRightLeftIcon aria-hidden />
      </Link>
      <CopyAction value={name} label={`Copy ${name}`} />
    </li>
  );
}

function OwnerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3 px-4 py-2">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Who the address belongs to: network name and ASN, country and announced range. */
function NetworkOwner({ network }: { network: NonNullable<ReverseLookup["network"]> }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Owner of this IP</h3>
      <dl className="divide-y overflow-hidden rounded-2xl border bg-muted/30 text-sm">
        <OwnerRow label="Network">
          {network.name || "Unknown"} <span className="text-muted-foreground">· AS{network.asn}</span>
        </OwnerRow>
        {network.country ? (
          <OwnerRow label="Country">
            <span className="inline-flex items-center gap-1.5">
              <Flag code={network.country} className="h-3 w-4" />
              {countryName(network.country)}
            </span>
          </OwnerRow>
        ) : null}
        <OwnerRow label="IP range">
          <span className="font-mono">{network.prefix}</span>
        </OwnerRow>
      </dl>
    </div>
  );
}

/**
 * The "IP to Hostname" form and result: an IP address in; out come the websites known to point to it
 * (checked live), its reverse DNS names ("Verified" when they point back) and who owns the address.
 * Every name has a copy button and a link to look it up forwards.
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
                  {result.websites.length
                    ? `${result.websites.length} website${result.websites.length === 1 ? "" : "s"} on this IP`
                    : result.hostnames.length
                      ? `${result.hostnames.length} reverse DNS name${result.hostnames.length === 1 ? "" : "s"}`
                      : "No hostname found"}
                  {result.network?.name ? ` · ${result.network.name}` : ""}
                </p>
              </div>
            </div>

            <ResultGroup title="Websites on this IP" count={result.websites.length}>
              {result.websites.length ? (
                <ul className="divide-y overflow-hidden rounded-2xl border bg-muted/30">
                  {result.websites.map((name) => (
                    <NameRow key={name} name={name} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  None known yet. Look a website up with{" "}
                  <Link href="/tools/hostname-to-ip" className="font-medium text-primary underline-offset-2 hover:underline">
                    Hostname to IP
                  </Link>{" "}
                  and, if it uses this IP, it will show here.
                </p>
              )}
            </ResultGroup>

            <ResultGroup title="Reverse DNS name" count={result.hostnames.length}>
              {result.hostnames.length ? (
                <ul className="divide-y overflow-hidden rounded-2xl border bg-muted/30">
                  {result.hostnames.map((h) => (
                    <NameRow key={h.name} name={h.name}>
                      {h.confirmed ? (
                        <span
                          className="mt-1 inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success"
                          title="This hostname points back to the same IP address"
                        >
                          <BadgeCheckIcon className="size-3" aria-hidden />
                          Verified
                        </span>
                      ) : null}
                    </NameRow>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  {result.reverseDnsFailed ? "The reverse DNS lookup didn't answer. Try again in a moment." : "No reverse DNS name is set for this IP."}
                </p>
              )}
            </ResultGroup>

            {result.network ? <NetworkOwner network={result.network} /> : null}
            <p className="flex items-start gap-2.5 rounded-2xl bg-info-soft px-4 py-3 text-xs text-foreground/80">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              <span>
                <strong className="font-semibold">Websites on this IP</strong> come from lookups made with Hostname to IP and are checked in DNS just now, so
                they really point here. Shared hosting and CDN addresses (Render, Cloudflare, Vercel…) can carry many more sites than we know of.{" "}
                <strong className="font-semibold">Reverse DNS</strong> is the name the IP&apos;s owner set; for hosting that&apos;s the provider.
              </span>
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
