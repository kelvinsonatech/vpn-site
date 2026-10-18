"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeftIcon, InfoIcon } from "lucide-react";
import { calendarSpan, daysBetween, formatSpan } from "@/lib/date-span";
import { cn } from "@/lib/utils";
import calendarImage from "@/assets/domain-age-result.webp";
import { CopyAction } from "../account/copy-action";
import { crossLinkClass, LookupError, LookupForm, useLookup } from "./lookup";

interface DomainAge {
  domain: string;
  registered: string | null;
  expires: string | null;
  updated: string | null;
  registrar: string | null;
  nameservers: string[];
  status: string[];
  dnssec: boolean | null;
  source: "rdap" | "whois";
}

const EXAMPLES = ["google.com", "wikipedia.org", "bbc.co.uk"].map((v) => ({ label: v, value: v }));

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatDate = (iso: string) => DATE.format(new Date(iso));

/** "clientTransferProhibited" → "client transfer prohibited"; already-spaced RDAP values stay as they are. */
const statusLabel = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-start gap-3 px-4 py-2.5">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** The expiry date with how far away it is ("in 2 years and 3 months") or how long ago it passed. */
function Expiry({ iso, now }: { iso: string; now: Date }) {
  const at = new Date(iso);
  const left = daysBetween(now, at);
  return (
    <>
      {formatDate(iso)}{" "}
      <span className={cn("font-normal", left < 0 ? "text-destructive" : left <= 30 ? "text-warning-strong" : "text-muted-foreground")}>
        {left < 0 ? `· expired ${formatSpan(calendarSpan(at, now))} ago` : left === 0 ? "· today" : `· in ${formatSpan(calendarSpan(now, at))}`}
      </span>
    </>
  );
}

/**
 * The "Domain Age" form and result: a domain (or a pasted link) in; out comes its age, registration
 * and expiry dates, registrar, name servers and status from the registry. Shareable as ?domain=.
 */
export function DomainAgeChecker({ initialDomain }: { initialDomain: string }) {
  const [value, setValue] = useState(initialDomain);
  const { state, run } = useLookup<DomainAge>({
    endpoint: "/api/public/tools/domain-age",
    field: "domain",
    param: "domain",
    shareKey: "domain",
    initial: initialDomain,
    emptyMessage: "Enter a domain name such as example.com.",
  });
  const result = state.phase === "done" ? state.result : null;
  const now = new Date();
  const age = result?.registered ? calendarSpan(new Date(result.registered), now) : null;
  const ageDays = result?.registered ? daysBetween(new Date(result.registered), now) : 0;

  return (
    <div className="grid gap-5">
      <LookupForm
        id="domain"
        label="Domain name or link"
        value={value}
        onValueChange={setValue}
        onSubmit={(v) => void run(v)}
        loading={state.phase === "loading"}
        placeholder="example.com"
        buttonLabel="Check age"
        examples={EXAMPLES}
      />

      <div aria-live="polite" className="contents">
        {state.phase === "error" ? (
          <LookupError message={state.message}>
            {state.code === "IS_IP" ? (
              <Link href={`/tools/ip-to-hostname?ip=${encodeURIComponent(value.trim())}`} className="font-semibold underline underline-offset-2">
                Find its hostname instead
              </Link>
            ) : null}
          </LookupError>
        ) : null}

        {result ? (
          <section aria-label="Result" className="grid gap-5 rounded-3xl border bg-card p-5 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 sm:p-6 motion-reduce:animate-none">
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- small bundled picture */}
              <img src={calendarImage.src} alt="" aria-hidden="true" width={44} height={44} draggable={false} className="size-11 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-base font-semibold [overflow-wrap:anywhere]">{result.domain}</p>
                <p className="text-sm text-muted-foreground">{result.registrar ? `Registered through ${result.registrar}` : "Registration record"}</p>
              </div>
              <Link
                href={`/tools/hostname-to-ip?host=${encodeURIComponent(result.domain)}`}
                aria-label={`Find the IP addresses of ${result.domain}`}
                title="Find its IP addresses"
                className={crossLinkClass}
              >
                <ArrowRightLeftIcon aria-hidden />
              </Link>
              <CopyAction value={result.domain} label={`Copy ${result.domain}`} />
            </div>

            <div className="rounded-2xl bg-primary/5 px-5 py-4 text-center ring-1 ring-primary/15">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Domain age</p>
              {age ? (
                <>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{formatSpan(age)}</p>
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {ageDays.toLocaleString("en-US")} day{ageDays === 1 ? "" : "s"} since {formatDate(result.registered!)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">This domain&apos;s registry doesn&apos;t publish when it was registered.</p>
              )}
            </div>

            <dl className="divide-y overflow-hidden rounded-2xl border bg-muted/30 text-sm">
              <Row label="Registered">{result.registered ? formatDate(result.registered) : "Not published"}</Row>
              <Row label="Expires">{result.expires ? <Expiry iso={result.expires} now={now} /> : "Not published"}</Row>
              {result.updated ? <Row label="Last updated">{formatDate(result.updated)}</Row> : null}
              <Row label="Registrar">{result.registrar ?? "Not published"}</Row>
              {result.nameservers.length ? (
                <Row label="Name servers">
                  <ul className="grid gap-0.5 font-mono text-[13px]">
                    {result.nameservers.map((ns) => (
                      <li key={ns}>{ns}</li>
                    ))}
                  </ul>
                </Row>
              ) : null}
              {result.status.length ? (
                <Row label="Status">
                  <span className="flex flex-wrap gap-1.5">
                    {result.status.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {statusLabel(s)}
                      </span>
                    ))}
                  </span>
                </Row>
              ) : null}
              {result.dnssec !== null ? <Row label="DNSSEC">{result.dnssec ? "Signed" : "Not signed"}</Row> : null}
            </dl>

            <p className="flex items-start gap-2.5 rounded-2xl bg-info-soft px-4 py-3 text-xs text-foreground/80">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              <span>
                From the registry&apos;s public record ({result.source === "rdap" ? "RDAP" : "WHOIS"}). The age counts from the current registration: a
                domain that expired and was registered again starts over.
              </span>
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
