"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyText } from "./browser-actions";

/**
 * Copy button with a short "Copied!" state and a clipboard fallback for non-secure contexts. Text
 * buttons swap their label in place (same width); icon buttons show a small "Copied!" tag above.
 */
export function CopyAction({
  value,
  label,
  children,
  variant = "ghost",
  size = "icon-sm",
  className,
  successMessage,
}: {
  value: string | (() => string);
  /** Accessible name, e.g. "Copy password". */
  label: string;
  /** Visible content for text buttons; icon-only when omitted. */
  children?: React.ReactNode;
  variant?: "ghost" | "outline" | "secondary" | "default";
  size?: "icon-sm" | "icon" | "sm" | "default" | "lg";
  className?: string;
  successMessage?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={children ? undefined : label}
      title={children ? undefined : label}
      className={cn("relative", size === "icon-sm" && "size-9", className)}
      onClick={async () => {
        const ok = await copyText(typeof value === "function" ? value() : value);
        if (!ok) {
          toast.error("Couldn't copy. Select the text and copy it manually.");
          return;
        }
        if (successMessage) toast.success(successMessage);
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <CheckIcon className="text-success" aria-hidden /> : <CopyIcon aria-hidden />}
      {children ? (
        // Both labels share one grid cell so the width never changes; only opacity switches, which
        // keeps the button's accessible name ("Copy all") the same.
        <span className="grid">
          <span className={cn("col-start-1 row-start-1 transition-opacity duration-150 motion-reduce:transition-none", copied && "opacity-0")}>{children}</span>
          <span
            className={cn("col-start-1 row-start-1 transition-opacity duration-150 motion-reduce:transition-none", !copied && "opacity-0")}
            aria-hidden
          >
            Copied!
          </span>
        </span>
      ) : copied ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] leading-4 font-medium text-background shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
        >
          Copied!
        </span>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </Button>
  );
}
