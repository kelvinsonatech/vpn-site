"use client";

import { AlertCircleIcon, KeyRoundIcon, LoaderCircleIcon } from "lucide-react";
import { PillInput } from "@/components/admin/auth/fields";
import { useServerAction } from "@/hooks/use-server-action";
import { mfaAction } from "../actions";
import { AUTH_BUTTON } from "../login-form";

export function MfaForm() {
  // Submitted via onSubmit (not <form action>) so typed values survive an error response.
  const { state, pending, onSubmit } = useServerAction((fd) => mfaAction({}, fd), { toasts: false });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {state.error ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
      <PillInput
        id="code"
        name="code"
        label="Authentication code"
        icon={<KeyRoundIcon />}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        autoFocus
        aria-describedby="code-hint"
        aria-invalid={state.error ? true : undefined}
        className="[&_input]:font-mono [&_input]:tracking-widest"
      />
      <p id="code-hint" className="-mt-1 px-5 text-xs text-muted-foreground">
        The 6-digit code from your authenticator app, or a recovery code.
      </p>
      <button type="submit" disabled={pending} className={AUTH_BUTTON}>
        {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : null}
        {pending ? "Checking…" : "Verify"}
      </button>
    </form>
  );
}
