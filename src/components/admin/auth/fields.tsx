"use client";

import { useState, useSyncExternalStore } from "react";
import { EyeIcon, EyeOffIcon, LightbulbIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** The pill around a sign-in field: tinted with a soft ring while focused. */
const PILL =
  "flex h-12 items-center overflow-hidden rounded-full border border-input bg-card transition-[border-color,background-color,box-shadow] duration-200 focus-within:border-primary focus-within:bg-primary/5 focus-within:ring-4 focus-within:ring-primary/15 has-[input[aria-invalid=true]]:border-destructive";
const INPUT = "h-full min-w-0 flex-1 bg-transparent pr-4 pl-3 text-[15px] outline-none placeholder:text-muted-foreground/70";

/** A rounded sign-in field with an icon in front; the visible placeholder doubles as a hidden label. */
export function PillInput({ icon, label, className, ...props }: React.ComponentProps<"input"> & { icon: React.ReactNode; label: string }) {
  return (
    <label className={cn(PILL, className)}>
      <span className="ml-5 flex shrink-0 text-muted-foreground [&_svg]:size-[18px]" aria-hidden>
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <input placeholder={label} className={INPUT} {...props} />
    </label>
  );
}

/** The password pill with a show/hide button joined on the right. */
export function PasswordPill({ icon, label, ...props }: Omit<React.ComponentProps<"input">, "type"> & { icon: React.ReactNode; label: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={PILL}>
      <label className="flex h-full min-w-0 flex-1 items-center">
        <span className="ml-5 flex shrink-0 text-muted-foreground [&_svg]:size-[18px]" aria-hidden>
          {icon}
        </span>
        <span className="sr-only">{label}</span>
        <input type={shown ? "text" : "password"} placeholder={label} className={INPUT} {...props} />
      </label>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="flex h-full w-14 shrink-0 items-center justify-center border-l border-input bg-muted/50 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground [&_svg]:size-[18px]"
      >
        {shown ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
      </button>
    </div>
  );
}

const subscribe = () => () => {};

/** Light/dark as a bulb and a switch. The knob follows the `dark` class, so nothing flashes before hydration. */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="group inline-flex items-center gap-2 rounded-full p-1.5 text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <LightbulbIcon className="size-4 transition-colors group-hover:text-foreground dark:text-primary" aria-hidden />
      <span className="relative h-5 w-9 rounded-full bg-muted-foreground/35 transition-colors dark:bg-primary">
        <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 dark:translate-x-4" />
      </span>
    </button>
  );
}
