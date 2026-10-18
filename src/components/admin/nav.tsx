"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLinkIcon,
  FlagIcon,
  LayoutDashboardIcon,
  Layers3Icon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ScrollTextIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  UserCogIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavKey = "dashboard" | "servers" | "protocols" | "accounts" | "reports" | "logs" | "admins" | "settings";

/** Small counters next to nav items (e.g. open reports). Zero or missing hides the badge. */
export type NavBadges = Partial<Record<NavKey, number>>;

const ITEMS: { key: NavKey; href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { key: "servers", href: "/admin/servers", label: "Servers", icon: ServerIcon },
  { key: "protocols", href: "/admin/protocols", label: "Protocols", icon: Layers3Icon },
  { key: "accounts", href: "/admin/accounts", label: "Accounts", icon: UsersIcon },
  { key: "reports", href: "/admin/reports", label: "Reports", icon: FlagIcon },
  { key: "logs", href: "/admin/logs", label: "Logs", icon: ScrollTextIcon },
  { key: "admins", href: "/admin/admins", label: "Administrators", icon: UserCogIcon },
  { key: "settings", href: "/admin/settings", label: "Site settings", icon: SlidersHorizontalIcon },
];

/*
 * The nav lives inside a `group/side` container (the desktop sidebar or the phone sheet) that has a
 * `data-open` attribute while it is wide. Rows keep their icon in the same place whatever the width;
 * labels fade in once the container has room for them, so the slim rail shows icons only.
 */

/** A label (or anything else) that only shows while the sidebar is open. */
export const WHEN_OPEN =
  "opacity-0 transition-opacity duration-200 group-data-[open]/side:opacity-100 group-data-[open]/side:delay-75 motion-reduce:transition-none";

/** One sidebar row: a 44px pill whose icon sits in the middle of the slim rail. */
export function sidebarRowClass(active = false) {
  return cn(
    "relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-2xl px-3.5 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:size-5 [&>svg]:shrink-0",
    active ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function AdminNav({ allowed, badges, onNavigate }: { allowed: NavKey[]; badges?: NavBadges; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1" aria-label="Admin">
      {ITEMS.filter((i) => allowed.includes(i.key)).map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        const badge = badges?.[item.key];
        return (
          <Link key={item.key} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={sidebarRowClass(active)}>
            <Icon aria-hidden />
            <span className={cn("min-w-0 flex-1 truncate", WHEN_OPEN)}>{item.label}</span>
            {badge ? (
              <>
                {/* On the slim rail a dot on the icon; open, the count. */}
                <span
                  aria-hidden
                  className="absolute top-2.5 left-8 size-2 rounded-full bg-warning ring-2 ring-card transition-opacity group-data-[open]/side:opacity-0"
                />
                <span
                  aria-hidden
                  className={cn("min-w-5 rounded-full bg-warning-soft px-1.5 py-px text-center text-[11px] font-semibold text-warning-strong tabular-nums", WHEN_OPEN)}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
                <span className="sr-only">, {badge} open</span>
              </>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The rows under the nav: the public website (new tab) and sign out. `pin`, on the desktop sidebar,
 * adds the "keep open" toggle beside Sign out (shown once the sidebar is open).
 */
export function SidebarFooter({
  logout,
  onNavigate,
  pin,
}: {
  logout: () => Promise<void>;
  onNavigate?: () => void;
  pin?: { pinned: boolean; onToggle: () => void };
}) {
  return (
    <div className="grid shrink-0 gap-1 border-t pt-3">
      <a href="/" target="_blank" rel="noopener" onClick={onNavigate} className={sidebarRowClass()}>
        <ExternalLinkIcon aria-hidden />
        <span className={cn("min-w-0 truncate", WHEN_OPEN)}>View public site</span>
      </a>
      <div className="relative">
        <form action={logout}>
          <button type="submit" className={cn(sidebarRowClass(), pin && "pr-12")}>
            <LogOutIcon aria-hidden />
            <span className={cn("min-w-0 truncate", WHEN_OPEN)}>Sign out</span>
          </button>
        </form>
        {pin ? (
          <button
            type="button"
            onClick={pin.onToggle}
            aria-pressed={pin.pinned}
            aria-label="Keep sidebar open"
            title={pin.pinned ? "Let the sidebar close" : "Keep the sidebar open"}
            className={cn(
              "pointer-events-none absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 group-data-[open]/side:pointer-events-auto [&_svg]:pointer-events-none [&_svg]:size-4.5",
              WHEN_OPEN,
            )}
          >
            {pin.pinned ? <PanelLeftCloseIcon aria-hidden /> : <PanelLeftOpenIcon aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
