"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightIcon, LoaderCircleIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Shared parts of the lookup tools: the request hook, the input form and the error message. */

export type LookupState<T> = { phase: "idle" } | { phase: "loading" } | { phase: "done"; result: T } | { phase: "error"; message: string; code?: string };

/**
 * POSTs { [field]: input } to a tools endpoint. On success the looked-up value (result[shareKey]) goes
 * into the address bar as ?param= so the result can be shared or reloaded; such a link looks itself
 * up on arrival.
 */
export function useLookup<T>({
  endpoint,
  field,
  param,
  shareKey,
  initial,
  emptyMessage,
}: {
  endpoint: string;
  field: string;
  param: string;
  shareKey: keyof T & string;
  initial: string;
  emptyMessage: string;
}) {
  const [state, setState] = useState<LookupState<T>>({ phase: "idle" });
  const request = useRef<AbortController | null>(null);

  const run = useCallback(
    async (input: string) => {
      const value = input.trim();
      if (!value) {
        setState({ phase: "error", message: emptyMessage });
        return;
      }
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setState({ phase: "loading" });
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
          signal: controller.signal,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setState({ phase: "error", message: body?.error?.message ?? "The lookup failed. Please try again.", code: body?.error?.code });
          return;
        }
        setState({ phase: "done", result: body as T });
        window.history.replaceState(null, "", `?${param}=${encodeURIComponent(String((body as T)[shareKey]))}`);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState({ phase: "error", message: "Couldn't reach the server. Check your connection and try again." });
      }
    },
    [endpoint, field, param, shareKey, emptyMessage],
  );

  const first = useRef(initial);
  useEffect(() => {
    if (first.current) void run(first.current);
    return () => request.current?.abort();
  }, [run]);

  return { state, run };
}

export function LookupForm({
  id,
  label,
  value,
  onValueChange,
  onSubmit,
  loading,
  placeholder,
  buttonLabel,
  examples,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  loading: boolean;
  placeholder: string;
  buttonLabel: string;
  examples: { label: string; value: string }[];
}) {
  return (
    <form
      noValidate
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      className="grid gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={id}
            name={id}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
            inputMode="url"
            enterKeyHint="go"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={300}
            aria-describedby={`${id}-hint`}
            className="h-12 rounded-2xl pl-10 font-mono"
          />
        </div>
        <Button type="submit" size="lg" disabled={loading} className="h-12 rounded-2xl px-6">
          {loading ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <ArrowRightIcon aria-hidden />}
          {loading ? "Looking up…" : buttonLabel}
        </Button>
      </div>
      <p id={`${id}-hint`} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
        Try:
        {examples.map((ex) => (
          <button
            key={ex.value}
            type="button"
            onClick={() => {
              onValueChange(ex.value);
              onSubmit(ex.value);
            }}
            className="rounded-full border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {ex.label}
          </button>
        ))}
      </p>
    </form>
  );
}

/** Small icon link to the other tool, next to a result's copy button. */
export const crossLinkClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4";

/** The failed lookup's message, with an optional next step (e.g. a link to the other tool). */
export function LookupError({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-danger-soft px-4 py-3 text-sm text-destructive" role="alert">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="min-w-0">
        {message}
        {children ? <> {children}</> : null}
      </p>
    </div>
  );
}
