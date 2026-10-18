"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CornerDownRightIcon, LoaderCircleIcon, NetworkIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CopyAction } from "../account/copy-action";

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

type State = { phase: "idle" } | { phase: "loading" } | { phase: "done"; result: Lookup } | { phase: "error"; message: string };

const EXAMPLES = ["google.com", "cloudflare.com", "whatsapp.net"];

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
          <li key={a.address} className="flex min-h-12 items-center gap-2 py-1 pr-1 pl-4">
            <span className="min-w-0 flex-1 font-mono text-sm font-medium select-all [overflow-wrap:anywhere]">{a.address}</span>
            {a.public ? null : <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-strong">Private</span>}
            <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline" title="How long DNS answers may be cached">
              TTL {formatTtl(a.ttl)}
            </span>
            <CopyAction value={a.address} label={`Copy ${a.address}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The "Hostname to IP" form and result: a hostname (or a pasted link) in, its IPv4 and IPv6 addresses
 * out, each with a copy button. The looked-up name goes into the address bar (?host=) so a result can
 * be shared or reloaded.
 */
export function HostnameToIp({ initialHost }: { initialHost: string }) {
  const [value, setValue] = useState(initialHost);
  const [state, setState] = useState<State>({ phase: "idle" });
  const request = useRef<AbortController | null>(null);

  const run = useCallback(async (host: string) => {
    const hostname = host.trim();
    if (!hostname) {
      setState({ phase: "error", message: "Enter a hostname such as example.com." });
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/public/tools/hostname-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setState({ phase: "error", message: body?.error?.message ?? "The lookup failed. Please try again." });
        return;
      }
      setState({ phase: "done", result: body as Lookup });
      window.history.replaceState(null, "", `?host=${encodeURIComponent((body as Lookup).hostname)}`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setState({ phase: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }, []);

  // A shared link (?host=...) looks itself up on arrival.
  const initial = useRef(initialHost);
  useEffect(() => {
    if (initial.current) void run(initial.current);
    return () => request.current?.abort();
  }, [run]);

  const result = state.phase === "done" ? state.result : null;
  const all = result ? [...result.ipv4, ...result.ipv6].map((a) => a.address) : [];

  return (
    <div className="grid gap-5">
      <form
        noValidate
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          void run(value);
        }}
        className="grid gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      >
        <label htmlFor="hostname" className="text-sm font-semibold">
          Hostname or link
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="hostname"
              name="hostname"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="example.com"
              inputMode="url"
              enterKeyHint="go"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={300}
              aria-describedby="hostname-hint"
              className="h-12 rounded-2xl pl-10 font-mono"
            />
          </div>
          <Button type="submit" size="lg" disabled={state.phase === "loading"} className="h-12 rounded-2xl px-6">
            {state.phase === "loading" ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <ArrowRightIcon aria-hidden />}
            {state.phase === "loading" ? "Looking up…" : "Get IP address"}
          </Button>
        </div>
        <p id="hostname-hint" className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
          Try:
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setValue(ex);
                void run(ex);
              }}
              className="rounded-full border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {ex}
            </button>
          ))}
        </p>
      </form>

      <div aria-live="polite" className="contents">
        {state.phase === "error" ? (
          <p className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-danger-soft px-4 py-3 text-sm text-destructive" role="alert">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.message}
          </p>
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
                <CopyAction value={all.join("\n")} label="Copy all addresses" variant="outline" size="sm" className={cn("shrink-0 rounded-full")}>
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
