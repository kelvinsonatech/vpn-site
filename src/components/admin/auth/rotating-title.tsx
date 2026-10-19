"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A heading whose greeting keeps changing ("Hello" → "Welcome" → ...): the new word settles in from
 * slightly larger while the old one fades. Screen readers get `label` only, once. With reduced
 * motion the first word just stays.
 */
export function RotatingTitle({ words, label, interval = 2600, className }: { words: string[]; label: string; interval?: number; className?: string }) {
  const [state, setState] = useState<{ index: number; previous: number | null }>({ index: 0, previous: null });

  useEffect(() => {
    if (words.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setState((s) => ({ index: (s.index + 1) % words.length, previous: s.index })), interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <h1 className={cn("grid justify-items-center", className)}>
      <span className="sr-only">{label}</span>
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden
          className={cn(
            "col-start-1 row-start-1 whitespace-nowrap",
            i === state.index ? state.previous !== null && "animate-title-in" : i === state.previous ? "animate-title-out" : "opacity-0",
          )}
        >
          {word}
        </span>
      ))}
    </h1>
  );
}
