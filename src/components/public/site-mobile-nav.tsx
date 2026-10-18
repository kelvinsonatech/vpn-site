"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActivityIcon, ChevronRightIcon, FlagIcon, HomeIcon, InfoIcon, MailIcon, MenuIcon, SearchIcon, UserRoundIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Brand } from "@/components/brand";
import { ProtocolIcon } from "@/components/protocol-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AvatarStack, CountBadge, useActiveAccounts } from "./my-accounts-menu";
import { groupProtocols, type NavProtocol } from "./nav";

const PRIMARY = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/server-status", label: "Server status", icon: ActivityIcon },
  { href: "/my-accounts", label: "My accounts", icon: UserRoundIcon },
];
const SUPPORT = [
  { href: "/report", label: "Report a problem", icon: FlagIcon },
  { href: "/contact", label: "Contact", icon: MailIcon },
  { href: "/about", label: "About", icon: InfoIcon },
];

const isCurrent = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/**
 * Slide-in navigation drawer for phones and tablets. Radix Dialog supplies the focus trap, Escape,
 * scroll lock and focus return; the drawer also closes whenever the route changes. The portal is
 * wrapped in .vl-public so the public palette applies outside the layout tree.
 */
export function SiteMobileNav({ siteName, protocols }: { siteName: string; protocols: NavProtocol[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const { active } = useActiveAccounts();
  const lastPath = useRef(pathname);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };
  const close = () => onOpenChange(false);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? protocols.filter((p) => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q)) : protocols;
    return groupProtocols(list);
  }, [protocols, query]);
  const matchCount = groups.reduce((n, g) => n + g.items.length, 0);

  const linkClass = (current: boolean) =>
    cn(
      "relative flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
      current ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "text-foreground hover:bg-muted",
    );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10 rounded-full border border-border/70 bg-card/80 shadow-sm lg:hidden data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
          aria-label="Open menu"
        >
          <MenuIcon className="size-5" />
          {active.length > 0 ? <span className="absolute top-1 right-1 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden /> : null}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <div className="vl-public contents">
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[oklch(0.2_0.08_268/0.5)] backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              searchRef.current?.focus({ preventScroll: true });
            }}
            className="vl-public fixed inset-y-0 right-0 z-50 flex w-[min(24rem,92vw)] flex-col border-l bg-background text-foreground shadow-2xl duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
          >
            <div className="relative overflow-hidden bg-hero px-4 pt-3 pb-5 text-hero-foreground">
              <div aria-hidden className="absolute inset-0 bg-hero-dots opacity-70" />
              <div className="relative flex h-12 items-center justify-between gap-3">
                <Link href="/" onClick={pathname === "/" ? close : undefined} className="min-w-0 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-white/60">
                  <Brand name={siteName} />
                </Link>
                <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">Site navigation and a searchable list of services</DialogPrimitive.Description>
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="flex size-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 outline-none transition-colors hover:bg-white/25 focus-visible:ring-[3px] focus-visible:ring-white/60"
                  >
                    <XIcon className="size-5" />
                  </button>
                </DialogPrimitive.Close>
              </div>
              <label className="relative mt-3 flex items-center">
                <span className="sr-only">Search services</span>
                <SearchIcon className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={protocols.length ? `Search ${protocols.length} services` : "Search services"}
                  className="h-11 w-full rounded-full bg-card pr-4 pl-10 text-sm text-foreground shadow-lg shadow-black/10 outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-white/60"
                />
              </label>
            </div>

            <nav aria-label="Mobile" className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
              {!query ? (
                <>
                  <ul className="space-y-1">
                    {PRIMARY.map((l) => {
                      const current = isCurrent(pathname, l.href);
                      return (
                        <li key={l.href}>
                          <Link href={l.href} onClick={pathname === l.href ? close : undefined} aria-current={current ? "page" : undefined} className={linkClass(current)}>
                            <l.icon className="size-4 shrink-0" />
                            <span className="flex-1">{l.label}</span>
                            {l.href === "/my-accounts" && active.length > 0 ? (
                              <span className="flex items-center gap-2">
                                <AvatarStack accounts={active} size={20} />
                                <CountBadge count={active.length} />
                              </span>
                            ) : current ? (
                              <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80">Here</span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}

              <section aria-label="Services" className={cn(!query && "mt-6")}>
                <div className="flex items-baseline justify-between px-3 pb-2">
                  <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Services</p>
                  {query ? (
                    <p className="text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
                      {matchCount} {matchCount === 1 ? "match" : "matches"}
                    </p>
                  ) : null}
                </div>
                {protocols.length === 0 ? (
                  <p className="mx-1 rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No services are published right now.</p>
                ) : matchCount === 0 ? (
                  <div className="mx-1 rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                    Nothing matches “{query}”.
                    <button type="button" onClick={() => setQuery("")} className="mt-2 block w-full font-semibold text-primary hover:underline">
                      Clear search
                    </button>
                  </div>
                ) : (
                  groups.map((g) => (
                    <div key={g.category} className="mb-3 rounded-2xl border bg-card p-1.5 shadow-sm">
                      <p className="flex items-center gap-2 px-2.5 pt-1.5 pb-1 text-xs font-semibold" style={{ color: `var(--tone-${g.category}, var(--primary))` }}>
                        <span className="size-1.5 rounded-full bg-current" aria-hidden />
                        {g.label}
                      </p>
                      <ul>
                        {g.items.map((p) => {
                          const current = isCurrent(pathname, p.href);
                          return (
                            <li key={p.slug}>
                              <Link
                                href={p.href}
                                onClick={pathname === p.href ? close : undefined}
                                aria-current={current ? "page" : undefined}
                                className={cn(
                                  "flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                                  current ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                                )}
                              >
                                <span
                                  className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white"
                                  style={{ background: `var(--tone-${p.category}, var(--primary))` }}
                                >
                                  <ProtocolIcon name={p.icon} className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold">{p.name}</span>
                                  <span className="block text-[11px] text-muted-foreground tabular-nums">
                                    {p.availableCount}/{p.serverCount} open
                                  </span>
                                </span>
                                <ChevronRightIcon className="size-4 text-muted-foreground/60" />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </section>

              {!query ? (
                <section aria-label="Support" className="mt-6">
                  <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Support</p>
                  <ul className="grid grid-cols-3 gap-2">
                    {SUPPORT.map((l) => {
                      const current = isCurrent(pathname, l.href);
                      return (
                        <li key={l.href}>
                          <Link
                            href={l.href}
                            onClick={pathname === l.href ? close : undefined}
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 text-center text-[11px] font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                              current ? "border-primary bg-primary/10 text-primary" : "bg-card hover:border-primary/30",
                            )}
                          >
                            <l.icon className="size-4 text-primary" />
                            {l.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </nav>

            <div className="flex items-center justify-between gap-3 border-t bg-card/80 px-4 py-3">
              <span className="text-sm text-muted-foreground">Appearance</span>
              <ThemeToggle />
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
