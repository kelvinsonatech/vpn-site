"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowRightIcon, DownloadIcon, LockKeyholeIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { convertLink, LinkError, type Conversion } from "@/lib/v2ray-json";
import { CopyAction } from "../account/copy-action";
import { downloadText, safeFilename } from "../account/browser-actions";
import { LookupError } from "./lookup";

/** Made-up links (example.com servers, random IDs) to show what each kind of link decodes to. */
const EXAMPLES = [
  {
    label: "VMess",
    value:
      "vmess://eyJhZGQiOiJidWcuZXhhbXBsZS5jb20iLCJhaWQiOiIwIiwiYWxwbiI6Imh0dHAvMS4xIiwiZnAiOiIiLCJob3N0Ijoibm9kZS5leGFtcGxlLm5ldCIsImlkIjoiYjgzMTM4MWQtNjMyNC00ZDUzLWFkNGYtOGNkYTQ4YjMwODExIiwibmV0Ijoid3MiLCJwYXRoIjoiL3ZtZXNzIiwicG9ydCI6IjQ0MyIsInBzIjoiRXhhbXBsZS1UTFMiLCJzY3kiOiJhdXRvIiwic25pIjoibm9kZS5leGFtcGxlLm5ldCIsInRscyI6InRscyIsInR5cGUiOiIiLCJ2IjoiMiJ9",
  },
  {
    label: "VLESS",
    value:
      "vless://b831381d-6324-4d53-ad4f-8cda48b30811@node.example.net:443?encryption=none&security=tls&sni=node.example.net&type=ws&host=node.example.net&path=%2Fvless#Example-VLESS",
  },
  { label: "Trojan", value: "trojan://example-password@node.example.net:443?security=tls&sni=node.example.net&type=tcp#Example-Trojan" },
];

const VIEWS = [
  { key: "decoded", label: "Decoded JSON", short: "Decoded", hint: "What the link contains, as JSON." },
  { key: "config", label: "Xray config", short: "Config", hint: "A complete client config: SOCKS on 127.0.0.1:10808, HTTP on 127.0.0.1:10809." },
  { key: "outbound", label: "Outbound only", short: "Outbound", hint: "Just the proxy outbound, to paste into a config you already have." },
] as const;
type View = (typeof VIEWS)[number]["key"];

const PROTOCOL_LABEL: Record<string, string> = { vmess: "VMess", vless: "VLESS", trojan: "Trojan", shadowsocks: "Shadowsocks" };
const TRANSPORT_LABEL: Record<string, string> = {
  tcp: "TCP",
  ws: "WebSocket",
  grpc: "gRPC",
  h2: "HTTP/2",
  httpupgrade: "HTTPUpgrade",
  xhttp: "XHTTP",
  kcp: "mKCP",
  quic: "QUIC",
};

/** Pretty JSON with keys, strings, numbers and literals coloured (React text nodes only, never HTML). */
function HighlightedJson({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const token = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  for (const m of text.matchAll(token)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [whole, str, colon, literal, num] = m;
    const cls = str
      ? colon
        ? "text-sky-700 dark:text-sky-300"
        : "text-emerald-700 dark:text-emerald-300"
      : literal
        ? "text-violet-700 dark:text-violet-300"
        : num
          ? "text-amber-700 dark:text-amber-300"
          : "";
    parts.push(
      <span key={m.index} className={cls}>
        {str ?? whole}
      </span>,
    );
    if (colon) parts.push(colon);
    last = m.index + whole.length;
  }
  parts.push(text.slice(last));
  return <>{parts.map((p, i) => (typeof p === "string" ? <Fragment key={`t${i}`}>{p}</Fragment> : p))}</>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-10 items-start gap-3 px-4 py-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** The decoded link in plain words. */
function Summary({ c }: { c: Conversion }) {
  const l = c.link;
  return (
    <dl className="divide-y overflow-hidden rounded-2xl border bg-muted/30 text-sm">
      <Row label="Server">
        <span className="font-mono">
          {l.address.includes(":") ? `[${l.address}]` : l.address}:{l.port}
        </span>
      </Row>
      <Row label={l.protocol === "vmess" || l.protocol === "vless" ? "User ID" : "Password"}>
        <span className="font-mono">{l.secret}</span>
      </Row>
      {l.method && l.protocol !== "vless" ? <Row label={l.protocol === "shadowsocks" ? "Method" : "Encryption"}>{l.method}</Row> : null}
      {l.flow ? <Row label="Flow">{l.flow}</Row> : null}
      {l.protocol !== "shadowsocks" ? (
        <Row label="Transport">
          {TRANSPORT_LABEL[l.network] ?? l.network}
          <span className="text-muted-foreground"> · {l.security === "none" ? "no TLS" : l.security === "reality" ? "REALITY" : "TLS"}</span>
        </Row>
      ) : null}
      {l.sni ? (
        <Row label="SNI">
          <span className="font-mono">{l.sni}</span>
        </Row>
      ) : null}
      {l.host ? (
        <Row label="Host">
          <span className="font-mono">{l.host}</span>
        </Row>
      ) : null}
      {l.path ? (
        <Row label={l.network === "grpc" ? "Service" : "Path"}>
          <span className="font-mono">{l.path}</span>
        </Row>
      ) : null}
    </dl>
  );
}

/**
 * "V2Ray to JSON": a vmess://, vless://, trojan:// or ss:// link in; out comes the link decoded as
 * JSON, a complete Xray client config and the outbound alone, each with copy and download. All of it
 * runs in the browser: links carry the account's UUID or password, so they are never sent anywhere
 * (and never put in the page address).
 */
export function V2rayToJson() {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [view, setView] = useState<View>("decoded");

  const result = useMemo(() => {
    if (submitted === null) return null;
    try {
      return { ok: true as const, c: convertLink(submitted) };
    } catch (e) {
      return { ok: false as const, message: e instanceof LinkError ? e.message : "That link couldn't be read." };
    }
  }, [submitted]);

  const decode = (link: string) => {
    setSubmitted(link);
    setView("decoded");
  };
  const c = result?.ok ? result.c : null;
  const json = c ? JSON.stringify(view === "decoded" ? c.decoded : view === "config" ? c.config : c.outbound, null, 2) : "";
  const baseName = c ? safeFilename(c.link.remark || c.link.protocol, c.link.protocol) : "";

  return (
    <div className="grid gap-5">
      <form
        noValidate
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          decode(value);
        }}
        className="grid gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      >
        <label htmlFor="v2ray-link" className="text-sm font-semibold">
          V2Ray link
        </label>
        <Textarea
          id="v2ray-link"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // One link per conversion, so Enter decodes instead of starting a new line.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              decode(value);
            }
          }}
          placeholder="vmess://…  vless://…  trojan://…  ss://…"
          rows={4}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={8192}
          aria-describedby="v2ray-link-hint"
          className="min-h-28 resize-y rounded-2xl font-mono break-all"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" className="h-11 rounded-2xl px-6">
            <ArrowRightIcon aria-hidden />
            Decode
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-2xl"
              onClick={() => {
                setValue("");
                setSubmitted(null);
                document.getElementById("v2ray-link")?.focus();
              }}
            >
              <XIcon aria-hidden />
              Clear
            </Button>
          ) : null}
        </div>
        <p id="v2ray-link-hint" className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
          Try an example:
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setValue(ex.value);
                decode(ex.value);
              }}
              className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {ex.label}
            </button>
          ))}
        </p>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <LockKeyholeIcon className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
          Decoded on your device. Your link holds your account&apos;s ID or password, so it never leaves this page.
        </p>
      </form>

      {/* Screen readers hear a short summary, never the ID, password or JSON (errors announce themselves as alerts). */}
      <p role="status" className="sr-only">
        {c
          ? `Decoded ${PROTOCOL_LABEL[c.link.protocol]} link ${c.link.remark || "without a name"}${c.warnings.length ? `, ${c.warnings.length} warning${c.warnings.length === 1 ? "" : "s"}` : ""}.`
          : ""}
      </p>
      <div className="contents">
        {result && !result.ok ? <LookupError message={result.message} /> : null}

        {c ? (
          <section
            aria-label="Result"
            className="grid min-w-0 gap-5 rounded-3xl border bg-card p-5 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 sm:p-6 motion-reduce:animate-none"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{PROTOCOL_LABEL[c.link.protocol]}</span>
              <p className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{c.link.remark || "Untitled link"}</p>
            </div>

            <Summary c={c} />

            {c.warnings.length ? (
              <ul className="grid gap-2 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
                {c.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning-strong" aria-hidden />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{w}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <Tabs value={view} onValueChange={(v) => setView(v as View)} className="min-w-0 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="h-10 rounded-xl max-sm:w-full">
                  {VIEWS.map((v) => (
                    <TabsTrigger key={v.key} value={v.key} className="rounded-lg px-3 text-xs sm:text-sm">
                      <span className="sm:hidden">{v.short}</span>
                      <span className="max-sm:hidden">{v.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="flex items-center gap-2">
                  <CopyAction value={json} label="Copy JSON" variant="outline" size="sm" className="rounded-full">
                    Copy JSON
                  </CopyAction>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      downloadText(json, `${baseName}${view === "decoded" ? "-decoded" : view === "outbound" ? "-outbound" : ""}.json`, "application/json")
                    }
                  >
                    <DownloadIcon aria-hidden />
                    Download
                  </Button>
                </div>
              </div>
              {VIEWS.map((v) => (
                <TabsContent key={v.key} value={v.key} tabIndex={-1} className="grid gap-2">
                  <p className="text-xs text-muted-foreground">{v.hint}</p>
                  <pre
                    tabIndex={0}
                    aria-label={`${v.label} for ${c.link.remark || "this link"}`}
                    className="max-h-[28rem] overflow-auto rounded-2xl border bg-muted/40 p-4 font-mono text-[12.5px] leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <code>{view === v.key ? <HighlightedJson text={json} /> : null}</code>
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
          </section>
        ) : null}
      </div>
    </div>
  );
}
