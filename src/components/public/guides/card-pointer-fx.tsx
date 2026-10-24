"use client";

import { useEffect, useRef } from "react";

const MAX_X = 7; // degrees of tilt at the top/bottom edge
const MAX_Y = 9; // degrees of tilt at the left/right edge

/**
 * Tilts its parent card toward the pointer and slides the card's spotlight (.vl-guide-spot) after
 * it. Mouse and pen only, and off when the visitor prefers reduced motion; renders nothing visible,
 * so the card stays a server component. Kept cheap: the card is measured once per hover (and on
 * scroll), each frame writes two inline transforms (never inherited custom properties, so nothing
 * inside the card is restyled) and the GPU moves both layers without repainting. The tilt eases
 * toward the pointer in one rAF loop that stops as soon as it settles.
 */
export function CardPointerFx() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const card = ref.current?.parentElement;
    const spot = card?.querySelector<HTMLElement>(".vl-guide-spot");
    if (!card || !window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;

    let rect = card.getBoundingClientRect();
    let target = { x: 0.5, y: 0.5 };
    let tilt = { x: 0.5, y: 0.5 };
    let frame = 0;

    const render = () => {
      tilt = { x: tilt.x + (target.x - tilt.x) * 0.2, y: tilt.y + (target.y - tilt.y) * 0.2 };
      card.style.transform = `perspective(1100px) rotateX(${((0.5 - tilt.y) * MAX_X).toFixed(2)}deg) rotateY(${((tilt.x - 0.5) * MAX_Y).toFixed(2)}deg)`;
      if (spot) spot.style.transform = `translate(${Math.round(target.x * rect.width)}px, ${Math.round(target.y * rect.height)}px) translate(-50%, -50%)`;
      frame = Math.abs(target.x - tilt.x) + Math.abs(target.y - tilt.y) > 0.002 ? requestAnimationFrame(render) : 0;
    };
    const measure = () => {
      rect = card.getBoundingClientRect();
    };
    const enter = () => {
      measure();
      card.dataset.tilting = "";
      window.addEventListener("scroll", measure, { passive: true });
    };
    const move = (e: PointerEvent) => {
      target = { x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) };
      if (!frame) frame = requestAnimationFrame(render);
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      target = tilt = { x: 0.5, y: 0.5 };
      window.removeEventListener("scroll", measure);
      delete card.dataset.tilting;
      card.style.transform = ""; // eases back flat with the card's CSS transition
    };

    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointermove", move, { passive: true });
    card.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <span ref={ref} hidden />;
}
