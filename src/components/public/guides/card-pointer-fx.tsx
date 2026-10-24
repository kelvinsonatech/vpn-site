"use client";

import { useEffect, useRef } from "react";

/**
 * Tilts its parent card a few degrees toward the pointer and moves the card's spotlight with it
 * (see .vl-guide-card in globals.css). Mouse and pen only, and off when the visitor prefers reduced
 * motion; renders nothing visible, so the card stays a server component.
 */
export function CardPointerFx() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const card = ref.current?.parentElement;
    if (!card || !window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        card.style.setProperty("--vl-mx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--vl-my", `${(y * 100).toFixed(1)}%`);
        card.style.setProperty("--vl-rx", `${((0.5 - y) * 7).toFixed(2)}deg`);
        card.style.setProperty("--vl-ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
        card.dataset.tilting = "";
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      for (const v of ["--vl-rx", "--vl-ry"]) card.style.removeProperty(v);
      delete card.dataset.tilting;
    };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <span ref={ref} hidden />;
}
