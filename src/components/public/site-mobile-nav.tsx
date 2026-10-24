"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FlagIcon,
  HomeIcon,
  InfoIcon,
  LaptopIcon,
  LayersIcon,
  MailIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
  UserRoundIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Popover as PopoverPrimitive } from "radix-ui";
import { BrandMark } from "@/components/brand";
import { ProtocolIcon } from "@/components/protocol-icon";
import { Button } from "@/components/ui/button";
import { isImageProtocolIcon, isRoundProtocolIcon } from "@/lib/protocol-icons";
import { cn } from "@/lib/utils";
import { AvatarStack, CountBadge, useActiveAccounts } from "./my-accounts-menu";
import type { NavProtocol } from "./nav";

const SUPPORT = [
  { href: "/guides", label: "Guides", icon: BookOpenIcon },
  { href: "/report", label: "Report a problem", icon: FlagIcon },
  { href: "/contact", label: "Contact", icon: MailIcon },
  { href: "/about", label: "About", icon: InfoIcon },
];

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: LaptopIcon },
] as const;

export const isCurrent = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/** The current page is marked by more than colour: bold text and a bar on the left (an outline in forced-colours mode). */
const CURRENT_MARK =
  "relative font-semibold before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:rounded-full before:bg-primary forced-colors:outline forced-colors:outline-1";

const rowClass = (current: boolean) =>
  cn(
    "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg:first-child]:size-5 [&>svg:first-child]:shrink-0",
    current ? cn("bg-accent text-primary [&>svg:first-child]:text-primary", CURRENT_MARK) : "text-foreground hover:bg-muted [&>svg:first-child]:text-muted-foreground",
  );

/** A service's logo: picture logos fill the tile, line icons sit on the service's colour. */
function ServiceTile({ protocol: p }: { protocol: NavProtocol }) {
  if (isImageProtocolIcon(p.icon)) {
    return <ProtocolIcon name={p.icon} className={cn("size-8", isRoundProtocolIcon(p.icon) ? "rounded-full" : "rounded-lg")} />;
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: `var(--tone-${p.category}, var(--primary))` }}>
      <ProtocolIcon name={p.icon} className="size-4" />
    </span>
  );
}

/** The services as rows (logo, name, open slots): the phone menu's Services list and the tab bar's Services sheet. */
export function ServiceLinks({
  protocols,
  pathname,
  onNavigate,
  ...props
}: { protocols: NavProtocol[]; pathname: string; onNavigate: () => void } & React.ComponentProps<"ul">) {
  return (
    <ul {...props}>
      {protocols.length === 0 ? (
        <li className="px-3 py-2 text-sm text-muted-foreground">No services are published right now.</li>
      ) : (
        protocols.map((p) => {
          const current = isCurrent(pathname, p.href);
          return (
            <li key={p.slug}>
              <Link
                href={p.href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  current ? "bg-accent" : "hover:bg-muted",
                )}
              >
                <ServiceTile protocol={p} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-semibold", current && "text-primary")}>{p.name}</span>
                  <span className="block text-[11px] text-muted-foreground tabular-nums">
                    {p.availableCount}/{p.serverCount} open
                  </span>
                </span>
                <ChevronRightIcon className="size-4 text-muted-foreground/60" />
              </Link>
            </li>
          );
        })
      )}
    </ul>
  );
}

/** Light / dark / system as one row of buttons (the menu only renders after hydration, so the theme is known). */
function ThemeRow() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-[15px] font-medium text-foreground">Appearance</span>
      <div role="group" aria-label="Colour theme" className="flex gap-0.5 rounded-full bg-muted p-0.5">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={theme === value}
            aria-label={label}
            title={label}
            className={cn(
              "flex size-10 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              theme === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Navigation for phones and tablets: a dropdown card under the menu button (Radix Popover, modal:
 * focus stays inside, Escape or a tap outside closes it, focus returns to the button). Tapping a
 * link closes it at once, before the next page arrives; it also closes whenever the route changes. The portal is wrapped in .vl-public so the public palette
 * applies outside the layout tree.
 */
export function SiteMobileNav({ siteName, protocols }: { siteName: string; protocols: NavProtocol[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { active } = useActiveAccounts();
  const inServices = protocols.some((p) => isCurrent(pathname, p.href));
  const [servicesOpen, setServicesOpen] = useState(inServices);
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  // From the lg breakpoint the header shows the full navigation and hides this button: close the menu
  // (e.g. a tablet rotated to landscape) instead of leaving it floating with no anchor.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setServicesOpen(inServices);
  };
  const close = () => setOpen(false);

  const link = (href: string, label: string, Icon: typeof HomeIcon, extra?: React.ReactNode) => {
    const current = isCurrent(pathname, href);
    return (
      <li key={href}>
        <Link href={href} onClick={close} aria-current={current ? "page" : undefined} className={rowClass(current)}>
          <Icon />
          <span className="flex-1">{label}</span>
          {extra}
        </Link>
      </li>
    );
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} modal>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10 rounded-full border border-border/70 bg-card/80 shadow-sm lg:hidden data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          {active.length > 0 && !open ? <span className="absolute top-1 right-1 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden /> : null}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <div className="vl-public contents">
          <PopoverPrimitive.Content
            align="end"
            sideOffset={10}
            collisionPadding={12}
            aria-label="Menu"
            onOpenAutoFocus={(e) => {
              // Focus the card itself rather than the first link, so nothing looks pre-selected.
              e.preventDefault();
              (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
            }}
            tabIndex={-1}
            className="z-50 max-h-[min(var(--radix-popover-content-available-height),42rem)] w-[min(22rem,calc(100vw-1.5rem))] origin-(--radix-popover-content-transform-origin) overflow-y-auto overscroll-contain rounded-3xl border bg-card p-2 text-card-foreground shadow-2xl shadow-[oklch(0.3_0.1_265/0.18)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 motion-reduce:animate-none"
          >
            {/* Header card (your accounts on this device, or the site when there are none yet) and a close
                button inside the card: while the menu is open everything outside it is hidden from screen
                readers, so the menu button's X can't be reached there. */}
            <div className="flex items-stretch gap-2">
              {active.length > 0 ? (
                <Link
                  href="/my-accounts"
                  onClick={close}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-muted/60 px-3 py-3 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <AvatarStack accounts={active} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {active.length} active account{active.length === 1 ? "" : "s"}
                    </span>
                    <span className="block text-xs text-muted-foreground">Saved on this device</span>
                  </span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-muted/60 px-3 py-3">
                  <BrandMark className="size-10" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{siteName}</span>
                    <span className="block text-xs text-muted-foreground">Free SSH &amp; VPN accounts</span>
                  </span>
                </div>
              )}
              <PopoverPrimitive.Close
                aria-label="Close menu"
                className="flex w-11 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <XIcon className="size-5" />
              </PopoverPrimitive.Close>
            </div>

            <nav aria-label="Mobile" className="mt-2">
              <ul className="grid gap-0.5">
                {link("/", "Home", HomeIcon)}
                <li>
                  <button
                    type="button"
                    onClick={() => setServicesOpen((v) => !v)}
                    aria-expanded={servicesOpen}
                    aria-controls="mobile-services"
                    className={rowClass(inServices)}
                  >
                    <LayersIcon />
                    <span className="flex-1 text-left">Services</span>
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">{protocols.length}</span>
                    <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", servicesOpen && "rotate-180")} />
                  </button>
                  {servicesOpen ? (
                    <ServiceLinks
                      id="mobile-services"
                      protocols={protocols}
                      pathname={pathname}
                      onNavigate={close}
                      className="mt-0.5 mb-1 ml-5 grid gap-0.5 border-l pl-2 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none"
                    />
                  ) : null}
                </li>
                {link("/server-status", "Server status", ActivityIcon)}
                {link("/tools", "Tools", WrenchIcon)}
                {link(
                  "/my-accounts",
                  "My accounts",
                  UserRoundIcon,
                  active.length > 0 ? (
                    <span className="flex items-center gap-2">
                      <AvatarStack accounts={active} size={20} />
                      <CountBadge count={active.length} />
                    </span>
                  ) : null,
                )}
              </ul>

              <div className="mx-3 my-2 border-t" role="separator" />
              <ul className="grid gap-0.5">{SUPPORT.map((l) => link(l.href, l.label, l.icon))}</ul>
            </nav>

            <div className="mx-3 my-2 border-t" role="separator" />
            <ThemeRow />
          </PopoverPrimitive.Content>
        </div>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
