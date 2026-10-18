"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActivityIcon, HomeIcon, LayersIcon, UserRoundIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { LiquidNav } from "./liquid-nav";
import { CountBadge, useActiveAccounts } from "./my-accounts-menu";
import type { NavProtocol } from "./nav";
import { isCurrent, ServiceLinks } from "./site-mobile-nav";

/** Icon tab; the current one is marked by the lens (its own tint only shows until the lens runs). */
const TAB =
  "relative flex h-12 w-16 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[current]:bg-primary/10 data-[current]:text-primary data-[state=open]:text-primary [&>svg]:size-[1.375rem] [&>svg]:transition-transform active:[&>svg]:scale-90";

/** Text fields that bring up the on-screen keyboard (the bar steps aside so it never covers them). */
const TYPING_FIELD = "input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=reset],[type=range],[type=color],[type=file]), textarea, select, [contenteditable=true]";

/**
 * Tab bar: a small floating frosted pill at the bottom of the screen (every screen size) with Home,
 * Services (a sheet listing every service), Server status and My accounts, highlighted by the same
 * liquid lens as the desktop header.
 */
export function MobileTabBar({ protocols }: { protocols: NavProtocol[] }) {
  const pathname = usePathname();
  const { active } = useActiveAccounts();
  const [servicesOpen, setServicesOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const lastPath = useRef(pathname);
  const inServices = protocols.some((p) => isCurrent(pathname, p.href));

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setServicesOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.matches(TYPING_FIELD)) setTyping(true);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.matches(TYPING_FIELD)) setTyping(false);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const tab = (href: string, label: string, Icon: typeof HomeIcon, extra?: React.ReactNode) => {
    const current = isCurrent(pathname, href);
    return (
      <Link href={href} aria-label={label} aria-current={current ? "page" : undefined} data-current={current || undefined} className={TAB}>
        <Icon aria-hidden />
        {extra}
      </Link>
    );
  };

  return (
    <PopoverPrimitive.Root open={servicesOpen} onOpenChange={setServicesOpen}>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] transition-[translate,opacity] duration-300 motion-reduce:transition-none lg:pb-5 print:hidden",
          typing && "translate-y-[calc(100%+1rem)] opacity-0",
        )}
      >
        <PopoverPrimitive.Anchor className="pointer-events-auto">
          <LiquidNav
            aria-label="Shortcuts"
            className="flex gap-1 rounded-full border border-white/60 bg-card/85 p-1 shadow-[0_12px_32px_-12px_rgb(15_30_90/0.35)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:ring-white/5 dark:shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)]"
          >
            {tab("/", "Home", HomeIcon)}
            <PopoverPrimitive.Trigger aria-label="Services" data-current={inServices || undefined} className={TAB}>
              <LayersIcon aria-hidden />
            </PopoverPrimitive.Trigger>
            {tab("/server-status", "Server status", ActivityIcon)}
            {tab(
              "/my-accounts",
              "My accounts",
              UserRoundIcon,
              <CountBadge count={active.length} className="absolute top-1.5 left-[calc(50%+0.2rem)] h-4 min-w-4 px-1 text-[10px] ring-2 ring-card" />,
            )}
          </LiquidNav>
        </PopoverPrimitive.Anchor>
      </div>
      <PopoverPrimitive.Portal>
        <div className="vl-public contents">
          <PopoverPrimitive.Content
            side="top"
            sideOffset={12}
            collisionPadding={12}
            aria-label="Services"
            tabIndex={-1}
            onOpenAutoFocus={(e) => {
              // Focus the sheet itself rather than the first service, so nothing looks pre-selected.
              e.preventDefault();
              (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
            }}
            className="z-50 max-h-[min(var(--radix-popover-content-available-height),30rem)] w-[min(24rem,calc(100vw-1.5rem))] origin-(--radix-popover-content-transform-origin) overflow-y-auto overscroll-contain rounded-3xl border bg-card/95 p-2 text-card-foreground shadow-2xl shadow-[oklch(0.3_0.1_265/0.18)] backdrop-blur-xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            <p className="flex items-center justify-between px-3 pt-2 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Services
              <span className="font-normal tabular-nums normal-case">{protocols.length}</span>
            </p>
            <ServiceLinks protocols={protocols} pathname={pathname} onNavigate={() => setServicesOpen(false)} className="grid gap-0.5" />
          </PopoverPrimitive.Content>
        </div>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
