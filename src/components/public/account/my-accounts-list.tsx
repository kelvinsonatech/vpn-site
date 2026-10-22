"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ActivityIcon,
  ArrowRightIcon,
  BanIcon,
  CalendarPlusIcon,
  EraserIcon,
  HistoryIcon,
  KeyRoundIcon,
  ListIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
  Trash2Icon,
  UserRoundPlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Flag } from "@/components/public/flag";
import { RelativeTime, useNow } from "@/components/public/live-time";
import { EmptyState } from "@/components/public/section";
import { cn } from "@/lib/utils";
import type { SavedAccountSummary } from "@/lib/public/types";
import { CopyAction } from "./copy-action";
import { DetailRow } from "./detail-row";
import { readSavedAccounts, removeSavedAccounts, restoreSavedAccounts, useSavedAccounts, clearSavedAccounts } from "./saved-accounts";
import { ExpiryCountdown, LocalDateTime } from "./time";
import { useRefreshSavedStatuses } from "./use-saved-statuses";

/**
 * /my-accounts: the accounts created in this browser as DiceBear profile cards (non-secret
 * summaries from localStorage only). Active accounts first with a live expiry countdown and a
 * lifetime bar, ended ones below; "Details" shows the saved non-secret connection details.
 * Removing is instant with an "Undo" toast. The website is asked which accounts the server removed
 * early (e.g. its multi-login limiter); those show as Removed.
 */

/** Removes summaries and offers to put them back where they were. */
function removeWithUndo(ids: string[], message: string, announce: (text: string) => void) {
  const all = readSavedAccounts();
  const removed = all.flatMap((summary, index) => (ids.includes(summary.id) ? [{ summary, index }] : []));
  if (removed.length === 0) return;
  removeSavedAccounts(ids);
  announce(message);
  toast(message, {
    action: {
      label: "Undo",
      onClick: () => {
        restoreSavedAccounts(removed);
        announce("Restored.");
      },
    },
  });
}

function displayName(a: SavedAccountSummary) {
  return a.username ?? `${a.protocol.name} account`;
}

/** The server removed this account before it expired, and when (from the saved summary). */
type Removal = { removedAt: string } | null;

function removalOf(a: SavedAccountSummary): Removal {
  return a.removedAt ? { removedAt: a.removedAt } : null;
}

/** Share of the account's lifetime that is left (1 = just created, 0 = expired). */
function lifeLeft(a: SavedAccountSummary, now: number) {
  const start = Date.parse(a.createdAt);
  const end = Date.parse(a.expiresAt);
  if (!(end > start)) return now < end ? 1 : 0;
  return Math.max(0, Math.min(1, (end - now) / (end - start)));
}

/** The saved non-secret details in the same "Label  value" format as the one-time result. */
function DetailsDialog({ account: a, expired, removal }: { account: SavedAccountSummary; expired: boolean; removal: Removal }) {
  const details = a.details ?? [];
  if (!details.length) return null;
  const text = () =>
    [
      `${a.protocol.name} account on ${a.server.name}`,
      ...details.map((d) => (d.value.includes("\n") ? `${d.label}:\n${d.value}` : `${d.label}: ${d.value}`)),
      `Expires: ${a.expiresAt}`,
    ].join("\n");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-10" aria-label={`Details of ${displayName(a)}`}>
          <ListIcon aria-hidden />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{displayName(a)}</DialogTitle>
          <DialogDescription>
            {a.protocol.name} on {a.server.name}. Kept on this device without the password, UUID or import links: those were shown only once.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-muted/35">
          <DetailRow label="Location">
            <span className="inline-flex items-center gap-1.5 font-sans font-medium">
              <span aria-hidden className="inline-flex">
                <Flag code={a.server.countryCode} className="h-3 w-4 shrink-0" />
              </span>
              {a.server.name}
            </span>
          </DetailRow>
          <DetailRow label="Protocol">
            <span className="font-sans font-medium">{a.protocol.name}</span>
          </DetailRow>
          {details.map((d, i) => (
            <DetailRow key={`${i}-${d.label}`} label={d.label} actions={<CopyAction value={d.value} label={`Copy ${d.label}`} />}>
              {d.value}
            </DetailRow>
          ))}
          <DetailRow label="Created">
            <span className="font-sans">
              <LocalDateTime iso={a.createdAt} />
            </span>
          </DetailRow>
          <DetailRow label={expired ? "Expired" : removal ? "Was due to expire" : "Expires"}>
            <span className="font-sans">
              <LocalDateTime iso={a.expiresAt} />
            </span>
          </DetailRow>
          {removal ? (
            <DetailRow label="Removed">
              <span className="font-sans">
                <LocalDateTime iso={removal.removedAt} />
              </span>
            </DetailRow>
          ) : null}
        </ul>
        <CopyAction value={text} label="Copy all details" variant="outline" size="lg" successMessage="Details copied" className="h-11 w-full rounded-xl">
          Copy all details
        </CopyAction>
      </DialogContent>
    </Dialog>
  );
}

function ProfileCard({ account: a, now, removal, onRemove }: { account: SavedAccountSummary; now: number; removal: Removal; onRemove: () => void }) {
  const expired = Date.parse(a.expiresAt) <= now;
  const removed = !expired && !!removal;
  const ended = expired || removed;
  const left = removed ? 0 : lifeLeft(a, now);
  const name = displayName(a);
  const tone = ended ? "bg-muted-foreground/40" : left <= 0.15 ? "bg-warning" : "bg-primary";

  return (
    <article
      aria-label={`${name}, ${a.protocol.name} on ${a.server.name}${expired ? ", expired" : removed ? ", removed by the server" : ""}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-[transform,box-shadow,border-color] duration-300 animate-in fade-in-0 slide-in-from-bottom-1 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        ended && "bg-card/70",
      )}
    >
      {/* Profile cover */}
      <div
        aria-hidden
        className={cn(
          "h-16 bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_oklch,var(--primary)_30%,transparent),transparent_60%),radial-gradient(120%_120%_at_100%_0%,color-mix(in_oklch,var(--info)_22%,transparent),transparent_60%)]",
          ended && "opacity-40 grayscale",
        )}
      />
      <div className="-mt-9 flex items-end justify-between gap-3 px-5">
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- DiceBear SVG data URI generated by our server */}
          <img
            src={a.avatar}
            alt=""
            width={68}
            height={68}
            draggable={false}
            className={cn("size-17 rounded-2xl bg-[color-mix(in_oklch,var(--primary)_14%,white)] shadow-md ring-4 ring-card", ended && "opacity-60 grayscale")}
          />
          <span
            aria-hidden
            className={cn(
              "absolute -right-1 -bottom-1 size-4 rounded-full ring-4 ring-card",
              removed ? "bg-destructive" : expired ? "bg-muted-foreground/50" : "bg-success",
            )}
          />
        </div>
        <span
          className={cn(
            "mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            removed ? "bg-destructive/10 text-destructive" : expired ? "bg-muted text-muted-foreground" : "bg-success-soft text-success",
          )}
        >
          {removed ? (
            <BanIcon className="size-3" aria-hidden />
          ) : (
            <span className={cn("size-1.5 rounded-full", expired ? "bg-muted-foreground/60" : "bg-success")} aria-hidden />
          )}
          {removed ? "Removed" : expired ? "Expired" : "Valid"}
        </span>
      </div>

      <div className="px-5 pt-3">
        <div className="flex min-w-0 items-center gap-1">
          <h3 className={cn("min-w-0 truncate font-mono text-lg font-semibold tracking-tight", ended && "text-muted-foreground")} title={name}>
            {name}
          </h3>
          {a.username ? <CopyAction value={a.username} label={`Copy username ${a.username}`} className="-my-1 size-10 shrink-0" /> : null}
        </div>
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">{a.protocol.name}</span>
          <Link
            href={a.server.href}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-sm hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Flag code={a.server.countryCode} className="h-3 w-4" />
            <span className="truncate">{a.server.name}</span>
          </Link>
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px border-y bg-border text-xs">
        <div className="bg-card px-5 py-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarPlusIcon className="size-3.5" aria-hidden />
            Created
          </dt>
          <dd className="mt-0.5 font-medium">
            <RelativeTime iso={a.createdAt} />
          </dd>
        </div>
        <div className="bg-card px-5 py-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            {removed ? <BanIcon className="size-3.5" aria-hidden /> : <TimerIcon className="size-3.5" aria-hidden />}
            {removed ? "Removed" : expired ? "Expired" : "Expires"}
          </dt>
          <dd className="mt-0.5 truncate font-medium">
            <LocalDateTime iso={removed && removal ? removal.removedAt : a.expiresAt} />
          </dd>
        </div>
      </dl>

      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{removed ? "Removed by the server" : expired ? "This account has ended" : "Time left"}</span>
          {removed && removal ? (
            <RelativeTime iso={removal.removedAt} className="text-muted-foreground" />
          ) : expired ? (
            <RelativeTime iso={a.expiresAt} className="text-muted-foreground" />
          ) : (
            <ExpiryCountdown iso={a.expiresAt} suffix="" className="font-semibold text-foreground" />
          )}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none", tone)} style={{ width: `${left * 100}%` }} />
        </div>
        {removed ? (
          <p className="mt-2.5 text-xs text-pretty text-muted-foreground">
            It stopped working before its expiry date, for example because it was used on more devices at once than the server allows.
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2">
        <Button asChild variant="ghost" size="sm" className="h-10 text-primary hover:text-primary">
          <Link href={a.server.href}>
            {ended ? <SparklesIcon aria-hidden /> : <PlusIcon aria-hidden />}
            {ended ? "New account" : "Create another"}
          </Link>
        </Button>
        <DetailsDialog account={a} expired={expired} removal={removed ? removal : null} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${name} from this device`}
          title="Remove from this device"
        >
          <Trash2Icon aria-hidden />
          <span className="hidden sm:inline lg:hidden xl:inline">Remove</span>
        </Button>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Skeleton className="h-16 rounded-none" />
      <div className="-mt-9 px-5">
        <Skeleton className="size-17 rounded-2xl ring-4 ring-card" />
      </div>
      <div className="grid gap-2 px-5 py-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-3 h-12 w-full" />
        <Skeleton className="h-2 w-full" />
      </div>
    </div>
  );
}

function ClearAllDialog({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="h-10 text-muted-foreground hover:text-destructive">
          <EraserIcon aria-hidden />
          Clear all
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clear this list?</DialogTitle>
          <DialogDescription>
            This removes {count === 1 ? "1 account" : `${count} accounts`} from this device&apos;s list. The accounts themselves keep working until
            they expire; you just won&apos;t see them here anymore.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-10">
              Keep them
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            className="h-10"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            <Trash2Icon aria-hidden />
            Clear list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MyAccountsList() {
  const accounts = useSavedAccounts();
  const now = useNow();
  const [announcement, setAnnouncement] = useState("");
  useRefreshSavedStatuses(accounts, now);

  const live = (
    <p className="sr-only" aria-live="polite" role="status">
      {announcement}
    </p>
  );

  // Storage and the clock are only known after hydration.
  if (accounts === null || now === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading your accounts">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <>
        {live}
        <EmptyState
          icon={<UserRoundPlusIcon />}
          title="No accounts on this device yet"
          description="Accounts you create here show up as profile cards with their own avatar, so you always know when they expire. Passwords, keys and links are never saved in this list."
        >
          <Button asChild className="h-11">
            <Link href="/#protocols">
              <SparklesIcon aria-hidden />
              Create an account
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/server-status">
              <ActivityIcon aria-hidden />
              Server status
            </Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  const active = accounts.filter((a) => Date.parse(a.expiresAt) > now && !removalOf(a));
  const ended = accounts.filter((a) => Date.parse(a.expiresAt) <= now || removalOf(a));
  const removedCount = ended.filter((a) => Date.parse(a.expiresAt) > now).length;
  const expiredCount = ended.length - removedCount;
  const endedWord = removedCount ? "ended" : "expired";
  const remove = (a: SavedAccountSummary) => removeWithUndo([a.id], `Removed ${displayName(a)} from this device.`, setAnnouncement);

  return (
    <div className="grid gap-10">
      {live}

      <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-success" aria-hidden />
            <span className="tabular-nums">{active.length}</span> active
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden />
            <span className="tabular-nums">{expiredCount}</span> expired
          </span>
          {removedCount ? (
            <span className="inline-flex items-center gap-1.5 text-destructive">
              <span className="size-2 rounded-full bg-destructive" aria-hidden />
              <span className="tabular-nums">{removedCount}</span> removed
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Button asChild variant="outline" className="h-10">
            <Link href="/#protocols">
              <PlusIcon aria-hidden />
              New account
            </Link>
          </Button>
          <ClearAllDialog
            count={accounts.length}
            onConfirm={() => {
              const all = readSavedAccounts().map((summary, index) => ({ summary, index }));
              clearSavedAccounts();
              setAnnouncement("List cleared.");
              toast("List cleared", {
                action: {
                  label: "Undo",
                  onClick: () => {
                    restoreSavedAccounts(all);
                    setAnnouncement("Restored.");
                  },
                },
              });
            }}
          />
        </div>
      </div>

      {active.length ? (
        <section aria-labelledby="my-active" className="grid gap-4">
          <h2 id="my-active" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            Active
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success tabular-nums">{active.length}</span>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((a) => (
              <li key={a.id} className="grid">
                <ProfileCard account={a} now={now} removal={removalOf(a)} onRemove={() => remove(a)} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">All of your accounts have {endedWord}. Creating a new one takes a few seconds.</p>
          <Button asChild className="h-10">
            <Link href="/#protocols">
              <SparklesIcon aria-hidden />
              Create an account
            </Link>
          </Button>
        </div>
      )}

      {ended.length ? (
        <section aria-labelledby="my-expired" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="my-expired" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <HistoryIcon className="size-4.5 text-muted-foreground" aria-hidden />
              {removedCount ? "Ended" : "Expired"}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">{ended.length}</span>
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 text-muted-foreground hover:text-destructive"
              onClick={() =>
                removeWithUndo(
                  ended.map((a) => a.id),
                  `Removed ${ended.length === 1 ? `1 ${endedWord} account` : `${ended.length} ${endedWord} accounts`}.`,
                  setAnnouncement,
                )
              }
            >
              <Trash2Icon aria-hidden />
              Remove {endedWord}
            </Button>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ended.map((a) => (
              <li key={a.id} className="grid">
                <ProfileCard account={a} now={now} removal={removalOf(a)} onRemove={() => remove(a)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="my-privacy" className="grid gap-4 rounded-2xl border bg-muted/30 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-5 sm:p-6">
        <span className="flex size-11 items-center justify-center rounded-xl bg-card text-primary shadow-xs ring-1 ring-border" aria-hidden>
          <ShieldCheckIcon className="size-5" />
        </span>
        <div className="grid gap-3 text-sm">
          <h2 id="my-privacy" className="font-semibold">
            What this page keeps
          </h2>
          <p className="text-pretty text-muted-foreground">
            This list lives only in this browser. It holds each account&apos;s avatar, username, service, server, dates and connection
            details such as host, ports and payload, so you can look them up again. Clearing your browser data removes it.
          </p>
          <p className="flex items-start gap-2 text-pretty text-muted-foreground">
            <KeyRoundIcon className="mt-0.5 size-4 shrink-0 text-warning-strong" aria-hidden />
            Passwords, UUIDs, keys, links and config files are not saved in this list, and our encrypted copy is erased within an hour of
            creation. If you lost them, create a new account. An account the server removes before its expiry date, for example for being
            used on too many devices at once, shows here as Removed.
          </p>
          <Link href="/report" className="inline-flex min-h-10 items-center gap-1.5 justify-self-start font-medium text-primary hover:underline">
            Account not working? Report a problem
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
