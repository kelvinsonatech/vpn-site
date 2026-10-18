"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { AdminNav, SidebarFooter, WHEN_OPEN, type NavBadges, type NavKey } from "./nav";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";

/** iOS-like easing: quick start, long soft landing. */
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

/**
 * The admin panel's frame on large screens: a floating sidebar that rests as a slim icon rail and
 * slides open over the page while the mouse is on it (or keyboard focus is in it), next to the page
 * column. "Keep sidebar open" pins it open and moves the page over. Below `lg` the sidebar is hidden
 * and the header's MobileNav takes over.
 */
export function AdminShell({
  allowed,
  badges,
  siteName,
  initialPinned,
  logout,
  children,
}: {
  allowed: NavKey[];
  badges?: NavBadges;
  siteName?: string;
  initialPinned: boolean;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [pinned, setPinned] = useState(initialPinned);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  // Hover, with a short delay each way so crossing the rail on the way elsewhere doesn't flick it
  // open. Chrome skips pointerleave when the node under the pointer was removed from the page, so
  // any pointer move outside the sidebar also counts as leaving. Touch has no hover; pinning is how
  // it stays open there.
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    let inside = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const set = (on: boolean) => {
      if (on === inside) return;
      inside = on;
      clearTimeout(timer);
      timer = setTimeout(() => setHovered(on), on ? 60 : 160);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "touch") set(e.target instanceof Node && aside.contains(e.target));
    };
    const leave = (e: PointerEvent) => e.pointerType !== "touch" && set(false);
    document.addEventListener("pointermove", move, { passive: true });
    aside.addEventListener("pointerleave", leave);
    // Already resting on it when the page finished loading.
    if (aside.matches(":hover")) set(true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointermove", move);
      aside.removeEventListener("pointerleave", leave);
    };
  }, []);
  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "pinned" : "rail"}; path=/admin; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  };
  const open = pinned || hovered || focused;

  return (
    <div
      data-pinned={pinned ? "" : undefined}
      className={cn("min-h-dvh lg:pl-25 lg:transition-[padding] lg:duration-300 lg:data-[pinned]:pl-67 motion-reduce:transition-none", EASE)}
    >
      <aside
        ref={asideRef}
        aria-label="Sidebar"
        data-open={open ? "" : undefined}
        // Keyboard focus opens it; a mouse click leaving focus on a link doesn't keep it open.
        onFocus={(e) => e.target.matches(":focus-visible") && setFocused(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
        className={cn(
          "group/side fixed inset-y-3 left-3 z-40 hidden w-18 flex-col overflow-hidden rounded-3xl border bg-card px-3 py-4 transition-[width,box-shadow] duration-300 data-[open]:w-60 lg:flex motion-reduce:transition-none",
          EASE,
          open && !pinned ? "shadow-2xl shadow-black/15" : "shadow-sm",
        )}
      >
        <Link
          href="/admin"
          className="flex h-12 shrink-0 items-center gap-3 overflow-hidden rounded-2xl px-1.5 whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandMark className="size-9" />
          <span className={cn("flex min-w-0 items-center gap-2 font-semibold tracking-tight", WHEN_OPEN)}>
            <span className="truncate">{siteName || siteConfig.name}</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Admin</span>
          </span>
        </Link>
        <div className="-mx-1 mt-5 mb-3 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1">
          <AdminNav allowed={allowed} badges={badges} />
        </div>
        <SidebarFooter logout={logout} pin={{ pinned, onToggle: togglePin }} />
      </aside>
      <div className="flex min-h-dvh min-w-0 flex-col">{children}</div>
    </div>
  );
}
