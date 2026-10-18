"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** A spring with a touch of overshoot, then a soft settle. */
const EASE = "cubic-bezier(0.3, 1.3, 0.55, 1)";
const LEAD_MS = 380;
const TRAIL_MS = 540;
const FADE = "opacity 200ms ease";
/** While gliding the lens flattens a little, then bounces back to round. */
const SQUISH: Keyframe[] = [{ transform: "scale(1, 1)" }, { transform: "scale(1, 0.88)", offset: 0.35 }, { transform: "scale(1, 1.04)", offset: 0.72 }, { transform: "scale(1, 1)" }];

/**
 * A pill navigation (the desktop header, the phone tab bar) with one "liquid" highlight, like iOS's
 * liquid glass: it glides to the item under the pointer or finger (or keyboard focus, or an open
 * menu's button) and back to the current page's item (marked data-current). The leading edge moves first, so the lens stretches and
 * settles. Until this hydrates the items paint their own highlight; under reduced motion it jumps.
 */
export function LiquidNav({ className, children, ...props }: React.ComponentProps<"nav">) {
  const navRef = useRef<HTMLElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const lens = lensRef.current;
    if (!nav || !lens) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const items = () => [...nav.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== lens);
    /** The nav item an event happened in (null for the gaps between items). */
    const itemOf = (node: EventTarget | null) => {
      let el = node instanceof Element ? node : null;
      while (el && el.parentElement !== nav) el = el.parentElement;
      return el instanceof HTMLElement && el !== lens ? el : null;
    };

    let hovered: HTMLElement | null = null;
    /** The item just tapped or clicked: the lens goes there at once, before the next page arrives. */
    let pressed: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    /** Focus only steers the lens for keyboard users (a menu closing hands focus back to its button). */
    let keyboard = false;
    let shown = false;
    let last = { left: 0, right: 0 };
    let squish: Animation | null = null;
    let leaveTimer = 0;
    let pressTimer = 0;
    let frame = 0;

    const target = () =>
      hovered ?? pressed ?? (keyboard ? focused : null) ?? items().find((el) => el.dataset.state === "open") ?? items().find((el) => el.dataset.current !== undefined) ?? null;

    const update = (animate: boolean) => {
      const el = target();
      if (!el) {
        lens.style.transition = FADE;
        lens.style.opacity = "0";
        shown = false;
        return;
      }
      const left = el.offsetLeft;
      const right = nav.clientWidth - left - el.offsetWidth;
      if (shown && left === last.left && right === last.right) return;
      if (animate && shown && !reduced.matches) {
        // Moving right the right edge leads and the left edge trails (and the other way round).
        const towardsRight = left - right > last.left - last.right;
        const lead = `${LEAD_MS}ms ${EASE}`;
        const trail = `${TRAIL_MS}ms ${EASE} 40ms`;
        lens.style.transition = `left ${towardsRight ? trail : lead}, right ${towardsRight ? lead : trail}, ${FADE}`;
        squish?.cancel();
        squish = lens.animate(SQUISH, { duration: TRAIL_MS + 40, easing: "ease-out" });
      } else {
        lens.style.transition = FADE;
      }
      lens.style.left = `${left}px`;
      lens.style.right = `${right}px`;
      lens.style.top = `${el.offsetTop}px`;
      lens.style.height = `${el.offsetHeight}px`;
      lens.style.opacity = "1";
      shown = true;
      last = { left, right };
    };
    // Several changes in one frame (focus leaving one item and entering the next) make one move.
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          update(true);
        });
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      window.clearTimeout(leaveTimer);
      const el = itemOf(e.target);
      if (el && el !== hovered) {
        hovered = el;
        schedule();
      }
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      // A short grace period, so brushing past the edge doesn't send the lens home and back.
      leaveTimer = window.setTimeout(() => {
        hovered = null;
        schedule();
      }, 90);
    };
    const onPress = (e: PointerEvent) => {
      const el = itemOf(e.target);
      if (!el) return;
      pressed = el;
      schedule();
      // By then the new page has marked its item current; if the tap went nowhere, the lens goes back.
      window.clearTimeout(pressTimer);
      pressTimer = window.setTimeout(() => {
        pressed = null;
        schedule();
      }, 1500);
    };
    const onFocusIn = (e: FocusEvent) => {
      focused = itemOf(e.target);
      schedule();
    };
    const onFocusOut = () => {
      focused = null;
      schedule();
    };
    const onKeyDown = () => {
      keyboard = true;
      schedule();
    };
    const onPointerDown = () => {
      keyboard = false;
      schedule();
    };

    update(false);
    nav.dataset.lens = "";
    nav.addEventListener("pointerover", onOver);
    nav.addEventListener("pointerleave", onLeave);
    nav.addEventListener("pointerdown", onPress);
    nav.addEventListener("focusin", onFocusIn);
    nav.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    // Menus opening and closing, and the current page changing on client navigation.
    const mutations = new MutationObserver(schedule);
    mutations.observe(nav, { subtree: true, attributes: true, attributeFilter: ["data-state", "data-current"] });
    // Item widths change when fonts or the saved-accounts avatars load: follow without gliding.
    const resize = new ResizeObserver(() => update(false));
    resize.observe(nav);
    return () => {
      nav.removeEventListener("pointerover", onOver);
      nav.removeEventListener("pointerleave", onLeave);
      nav.removeEventListener("pointerdown", onPress);
      nav.removeEventListener("focusin", onFocusIn);
      nav.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      mutations.disconnect();
      resize.disconnect();
      window.clearTimeout(leaveTimer);
      window.clearTimeout(pressTimer);
      cancelAnimationFrame(frame);
      squish?.cancel();
      delete nav.dataset.lens;
    };
  }, []);

  return (
    <nav
      ref={navRef}
      // Once the lens is running it is the only highlight: the items drop their own backgrounds.
      className={cn("relative isolate [&[data-lens]>:is(a,button)]:bg-transparent [&[data-lens]>:is(a,button):not(:focus-visible)]:ring-0", className)}
      {...props}
    >
      <span
        ref={lensRef}
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 rounded-full bg-primary/10 opacity-0 shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_6px_16px_-8px_oklch(0.5_0.24_265/0.5)] ring-1 ring-primary/20 dark:bg-primary/20 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_6px_16px_-8px_rgb(0_0_0/0.6)]"
      />
      {children}
    </nav>
  );
}
