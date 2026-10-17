"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenIcon, DownloadIcon, EyeIcon, EyeOffIcon, FileTextIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/public/flag";
import { cn } from "@/lib/utils";
import type { PublicAccountResult } from "@/lib/public/types";
import { accountText, resultItems, type ResultItem } from "./account-sections";
import { downloadText, safeFilename } from "./browser-actions";
import { prefersReducedMotion } from "./celebration";
import { launchConfetti } from "./confetti";
import { CopyAction } from "./copy-action";
import { DetailRow } from "./detail-row";
import { QrDialog } from "./qr-dialog";
import { ExpiryCountdown, formatLocalDateTime, formatUtcDateTime, LocalDateTime, useExpired } from "./time";

/**
 * The one-time account result, shown in place of the form: a gradient "Your account is ready!"
 * header with the DiceBear avatar, then the account as one compact "Label  value" block (server,
 * protocol, every connection detail, created and expiry), quick-import links/configs with a big copy
 * button, payloads and files, and Copy all / Save as .txt. Secrets stay hidden until revealed.
 * The data lives only in memory and is never sent anywhere. `celebrate` (a newly created account,
 * once) adds the confetti bursts.
 */

/** One-line app configs ("host:ports@user:pass") are offered like share links: big copy button. */
const isImport = (it: ResultItem) => it.kind === "uri" || (it.kind === "secret" && it.id.endsWith("_config"));

/** Green check that pops in and draws itself; static under reduced motion. */
function SuccessCheck() {
  return (
    <span className="absolute -right-2 -bottom-2 flex size-8 items-center justify-center" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-success opacity-0 motion-safe:animate-check-ring" />
      <span className="relative flex size-8 items-center justify-center rounded-full bg-success text-white shadow-sm ring-[3px] ring-white motion-safe:animate-check-pop">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 12.5l4.2 4.2L18.5 7.8" pathLength={1} strokeDasharray={1} className="motion-safe:animate-check-draw" />
        </svg>
      </span>
    </span>
  );
}

function RevealButton({ revealed, onToggle, label }: { revealed: boolean; onToggle: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-9"
      aria-pressed={revealed}
      aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
      title={revealed ? "Hide" : "Show"}
      onClick={onToggle}
    >
      {revealed ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
    </Button>
  );
}

function useMask(item: ResultItem) {
  const maskable = item.sensitive || item.kind === "secret";
  const [revealed, setRevealed] = useState(!maskable);
  return { maskable, revealed, hidden: maskable && !revealed, toggle: () => setRevealed((v) => !v), reveal: () => setRevealed(true) };
}

function ItemDetailRow({ item, filenameBase }: { item: ResultItem; filenameBase: string }) {
  const m = useMask(item);
  return (
    <DetailRow
      label={item.label}
      actions={
        <>
          {m.maskable ? <RevealButton revealed={m.revealed} onToggle={m.toggle} label={item.label} /> : null}
          {item.qr ? <QrDialog value={item.value} title={item.label} filename={`${filenameBase}-${item.label}`} /> : null}
          {item.copyable ? <CopyAction value={item.value} label={`Copy ${item.label}`} /> : null}
        </>
      }
    >
      {m.hidden ? (
        <span className="tracking-wider whitespace-nowrap text-muted-foreground">
          ••••••••••<span className="sr-only"> (hidden)</span>
        </span>
      ) : (
        item.value
      )}
    </DetailRow>
  );
}

/** Text that stays blurred until revealed (links, configs, payloads that are secret). */
function MaskedBlock({ hidden, onReveal, className, children }: { hidden: boolean; onReveal: () => void; className?: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <pre className={cn("overflow-auto font-mono text-[12.5px] leading-relaxed break-all whitespace-pre-wrap", hidden && "pointer-events-none blur-[5px] select-none", className)} aria-hidden={hidden || undefined}>
        {children}
      </pre>
      {hidden ? (
        <button
          type="button"
          onClick={onReveal}
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/90 px-3 py-1.5 shadow-sm">
            <EyeIcon className="size-4" aria-hidden />
            Tap to reveal
          </span>
        </button>
      ) : null}
    </div>
  );
}

/** A share link or one-line app config with a big copy button, like "Copy to app". */
function ImportCard({ item, filenameBase }: { item: ResultItem; filenameBase: string }) {
  const m = useMask(item);
  return (
    <li className="grid gap-2.5 rounded-xl border bg-background/60 p-3">
      <div className="flex min-h-9 items-center justify-between gap-2">
        <span className="min-w-0 text-sm font-medium">{item.label}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          {m.maskable ? <RevealButton revealed={m.revealed} onToggle={m.toggle} label={item.label} /> : null}
          {item.qr ? <QrDialog value={item.value} title={item.label} filename={`${filenameBase}-${item.label}`} /> : null}
        </div>
      </div>
      <MaskedBlock hidden={m.hidden} onReveal={m.reveal} className="max-h-28 rounded-lg border bg-muted/40 px-3 py-2.5">
        {item.value}
      </MaskedBlock>
      <CopyAction value={item.value} label={`Copy ${item.label}`} variant="default" size="lg" className="h-11 w-full rounded-xl text-base">
        Copy {item.label}
      </CopyAction>
    </li>
  );
}

function CodeBlock({ item, filenameBase }: { item: ResultItem; filenameBase: string }) {
  const m = useMask(item);
  return (
    <li className="rounded-xl border bg-background/60">
      <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-3.5">
        <span className="text-sm font-medium">{item.label}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          {m.maskable ? <RevealButton revealed={m.revealed} onToggle={m.toggle} label={item.label} /> : null}
          {item.qr ? <QrDialog value={item.value} title={item.label} filename={`${filenameBase}-${item.label}`} /> : null}
          {item.copyable ? <CopyAction value={item.value} label={`Copy ${item.label}`} /> : null}
        </div>
      </div>
      <MaskedBlock hidden={m.hidden} onReveal={m.reveal} className="max-h-56 border-t px-3.5 py-2.5">
        {item.value}
      </MaskedBlock>
    </li>
  );
}

function FileRow({ item, filenameBase }: { item: ResultItem; filenameBase: string }) {
  const filename = safeFilename(item.filename ?? `${filenameBase}-${item.label}.txt`);
  const size = new Blob([item.value]).size;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/60 px-3 py-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <FileTextIcon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.label}</span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {filename} · {size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`}
        </span>
      </span>
      <div className="flex items-center gap-1">
        {item.qr ? <QrDialog value={item.value} title={item.label} filename={filename} /> : null}
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => downloadText(item.value, filename, item.mimeType)}>
          <DownloadIcon aria-hidden />
          Download
        </Button>
      </div>
    </li>
  );
}

function Block({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-2.5">
      <div>
        <h3 id={id} className="text-sm font-semibold">
          {title}
        </h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AccountResult({
  account,
  siteName,
  countryCode,
  countryName,
  city,
  createdAt,
  guideHref,
  celebrate = false,
  onCreateAnother,
}: {
  account: PublicAccountResult;
  siteName: string;
  countryCode: string;
  countryName: string;
  city?: string | null;
  /** When the visitor sent the request (ISO), shown as "Created". */
  createdAt?: string;
  guideHref: string;
  /** Play the confetti: only for a newly created account, once (see celebration.ts). */
  celebrate?: boolean;
  onCreateAnother: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const items = useMemo(() => resultItems(account), [account]);
  const details = items.filter((it) => (it.kind === "text" || it.kind === "secret") && !isImport(it));
  const imports = items.filter(isImport);
  const code = items.filter((it) => it.kind === "multiline");
  const files = items.filter((it) => it.kind === "file");
  const expired = useExpired(account.expiresAt);
  const filenameBase = safeFilename(`${siteName}-${account.protocol.slug}-${account.username ?? "account"}`.toLowerCase(), "account");
  const avatarOk = typeof account.avatar === "string" && account.avatar.startsWith("data:image/");
  const location = [city, countryName].filter(Boolean).join(", ");

  // Move focus to the result so keyboard and screen reader users land on it.
  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.focus({ preventScroll: true });
    el.closest("[data-result-card]")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (!celebrate || prefersReducedMotion()) return;
    return launchConfetti();
  }, [celebrate]);

  // Filled after mount so screen readers announce it (a live region present from the start is often skipped).
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(true), 150);
    return () => clearTimeout(t);
  }, []);

  const text = (withFiles: boolean) =>
    accountText(account, { siteName, expiresLabel: formatLocalDateTime(account.expiresAt) || formatUtcDateTime(account.expiresAt), withFiles });

  return (
    <div data-result-card className="scroll-mt-24 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
      <p role="status" className="sr-only">
        {announced ? "Account created. Copy your details below and connect securely." : ""}
      </p>

      <div className="relative overflow-hidden bg-card-band px-5 py-6 text-hero-foreground sm:px-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-hero-dots" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="relative shrink-0">
            {avatarOk ? (
              // eslint-disable-next-line @next/next/no-img-element -- server-generated DiceBear SVG data URI
              <img
                src={account.avatar}
                alt=""
                width={76}
                height={76}
                draggable={false}
                className="size-19 rounded-2xl bg-[color-mix(in_oklch,var(--primary)_14%,white)] shadow-md ring-4 ring-white/25 animate-in zoom-in-75 duration-500 motion-reduce:animate-none"
              />
            ) : (
              <span className="flex size-19 items-center justify-center rounded-2xl bg-white/15 ring-4 ring-white/25" />
            )}
            <SuccessCheck />
          </div>
          <div className="min-w-0 flex-1 animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both delay-100 duration-500 motion-reduce:animate-none">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight text-balance outline-none sm:text-2xl">
              Your account is ready!
            </h2>
            <p className="mt-1 text-sm text-white/85">Copy your details below and connect securely.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-4 py-5 sm:px-6">
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3" role="note">
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-warning-strong" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">Shown only once — save it now</p>
            <p className="text-muted-foreground">
              These details won&apos;t be shown again once you leave or reload this page. Copy them, download the .txt file or scan the QR
              codes now.
            </p>
          </div>
        </div>

        <Block id="result-details" title="Account details">
          <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-muted/35">
            <DetailRow label="Location">
              <span className="font-sans">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {/* Decorative here: the country is written out next to it. */}
                  <span aria-hidden className="inline-flex">
                    <Flag code={countryCode} className="h-3 w-4 shrink-0" title={countryName} />
                  </span>
                  {account.server.name}
                </span>
                {location ? (
                  <span className="block text-xs text-muted-foreground sm:inline sm:text-sm">
                    <span className="hidden sm:inline"> · </span>
                    {location}
                  </span>
                ) : null}
              </span>
            </DetailRow>
            <DetailRow label="Protocol">
              <span className="font-sans font-medium">{account.protocol.name}</span>
            </DetailRow>
            {details.map((it) => (
              <ItemDetailRow key={it.id} item={it} filenameBase={filenameBase} />
            ))}
            {createdAt ? (
              <DetailRow label="Created">
                <span className="font-sans">
                  <LocalDateTime iso={createdAt} />
                </span>
              </DetailRow>
            ) : null}
            <DetailRow label={expired ? "Expired" : "Expires"}>
              <span className="font-sans">
                <LocalDateTime iso={account.expiresAt} />
                {expired ? (
                  <span className="block text-xs font-medium text-destructive">This account has expired.</span>
                ) : (
                  <span className="block text-xs text-muted-foreground">
                    <ExpiryCountdown iso={account.expiresAt} className="font-medium text-foreground" />
                  </span>
                )}
              </span>
            </DetailRow>
          </ul>
        </Block>

        {imports.length ? (
          <Block id="result-import" title="Quick import" description="Paste it into your app, or scan the QR code.">
            <ul className="grid gap-2.5">
              {imports.map((it) => (
                <ImportCard key={it.id} item={it} filenameBase={filenameBase} />
              ))}
            </ul>
          </Block>
        ) : null}

        {code.length ? (
          <Block id="result-config" title="Payload & config" description="Paste these into your tunnelling app.">
            <ul className="grid gap-2.5">
              {code.map((it) => (
                <CodeBlock key={it.id} item={it} filenameBase={filenameBase} />
              ))}
            </ul>
          </Block>
        ) : null}

        {files.length ? (
          <Block id="result-files" title="Files" description="Configuration files for your client.">
            <ul className="grid gap-2.5">
              {files.map((it) => (
                <FileRow key={it.id} item={it} filenameBase={filenameBase} />
              ))}
            </ul>
          </Block>
        ) : null}

        {items.length === 0 ? <p className="text-sm text-muted-foreground">The server didn&apos;t return any connection details.</p> : null}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <CopyAction
            value={() => text(false)}
            label="Copy all details"
            variant={imports.length ? "outline" : "default"}
            size="lg"
            successMessage="All details copied"
            className="h-11 rounded-xl text-base"
          >
            Copy all details
          </CopyAction>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => downloadText(text(true), `${filenameBase}.txt`)}>
              <DownloadIcon aria-hidden />
              Save as .txt
            </Button>
            <Button asChild variant="ghost" className="h-11 rounded-xl">
              <Link href={guideHref}>
                <BookOpenIcon aria-hidden />
                How to connect
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground">Saved to My accounts on this device (without any secrets).</p>
        <Button type="button" variant="secondary" className="h-10" onClick={onCreateAnother}>
          <PlusIcon aria-hidden />
          Create another account
        </Button>
      </div>
    </div>
  );
}
