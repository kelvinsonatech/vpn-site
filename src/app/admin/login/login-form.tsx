"use client";

import { AlertCircleIcon, LoaderCircleIcon, LockIcon, UserIcon } from "lucide-react";
import { PasswordPill, PillInput } from "@/components/admin/auth/fields";
import { useServerAction } from "@/hooks/use-server-action";
import { loginAction } from "./actions";

/** Pill-shaped "Log in" button with a press-in effect on tap or click. */
export const AUTH_BUTTON =
  "mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground shadow-md shadow-primary/25 outline-none transition-[transform,filter,box-shadow] duration-150 hover:brightness-105 focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-[0.97] active:shadow-sm disabled:pointer-events-none disabled:opacity-70 [&_svg]:size-4";

export function LoginForm() {
  // Submitted via onSubmit (not <form action>) so typed values survive an error response.
  const { state, pending, onSubmit } = useServerAction((fd) => loginAction({}, fd), { toasts: false });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {state.error ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
      <PillInput id="email" name="email" type="email" label="Email" icon={<UserIcon />} autoComplete="username" required autoFocus aria-invalid={state.error ? true : undefined} />
      <PasswordPill id="password" name="password" label="Password" icon={<LockIcon />} autoComplete="current-password" required aria-invalid={state.error ? true : undefined} />
      <button type="submit" disabled={pending} className={AUTH_BUTTON}>
        {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : null}
        {pending ? "Signing in…" : "Log In"}
      </button>
    </form>
  );
}
