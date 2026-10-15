"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CompassIcon, SignalLowIcon, ShieldCheckIcon, SmartphoneIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickerProtocol {
  slug: string;
  name: string;
  category: string;
  href: string;
  availableCount: number;
  serverCount: number;
}

const NEEDS = [
  {
    key: "simple",
    icon: SmartphoneIcon,
    title: "Simplest setup on a phone",
    family: "SSH tunnel",
    categories: ["ssh"],
    why: "A username and password typed into an app such as HTTP Custom. Easy to understand and widely supported.",
  },
  {
    key: "share",
    icon: LinkIcon,
    title: "One link, many apps",
    family: "V2Ray / Xray (VLESS, VMess, Trojan)",
    categories: ["v2ray"],
    why: "You get a share link or QR code that apps like v2rayNG, Hiddify or NekoBox import in one tap.",
  },
  {
    key: "unstable",
    icon: SignalLowIcon,
    title: "Unstable mobile network",
    family: "UDP (Hysteria, UDP Custom)",
    categories: ["udp"],
    why: "UDP-based protocols recover faster from packet loss, so they often feel quicker on weak signal.",
  },
  {
    key: "device",
    icon: ShieldCheckIcon,
    title: "Whole-device VPN",
    family: "VPN (WireGuard, OpenVPN)",
    categories: ["vpn"],
    why: "A classic VPN profile routes the whole device, with official apps on every major platform.",
  },
] as const;

/**
 * Offline protocol guidance: the advice itself is static education. Matching services are linked only
 * when they really exist in the published catalogue; otherwise the panel says so.
 */
export function ProtocolPicker({ protocols }: { protocols: PickerProtocol[] }) {
  const [need, setNeed] = useState<(typeof NEEDS)[number]["key"]>("simple");
  const current = NEEDS.find((n) => n.key === need) ?? NEEDS[0];
  const matches = protocols.filter((p) => (current.categories as readonly string[]).includes(p.category));

  return (
    <div className="grid gap-5 overflow-hidden rounded-[2rem] border bg-card p-4 shadow-[0_20px_50px_-30px_rgb(15_30_120/0.35)] sm:p-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8 lg:p-8">
      <div role="radiogroup" aria-label="What matters most to you?" className="grid gap-2.5">
        {NEEDS.map((n) => {
          const on = n.key === need;
          return (
            <button
              key={n.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setNeed(n.key)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3.5 text-left outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on ? "border-primary bg-primary/[0.07] shadow-sm" : "hover:border-primary/30 hover:bg-muted/60",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", on ? "bg-primary text-primary-foreground" : "bg-accent text-primary")}>
                <n.icon className="size-5" />
              </span>
              <span className="flex-1 font-semibold">{n.title}</span>
              <span className={cn("size-4 rounded-full border-2", on ? "border-primary bg-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-card" : "border-border")} aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="relative flex flex-col rounded-3xl bg-hero p-6 text-hero-foreground sm:p-7" aria-live="polite">
        <div aria-hidden className="absolute inset-0 rounded-3xl bg-hero-dots opacity-60" />
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase opacity-80">
            <CompassIcon className="size-3.5" /> Our suggestion
          </p>
          <h3 className="mt-3 text-2xl font-bold tracking-tight">{current.family}</h3>
          <p className="mt-2 text-sm text-pretty text-white/85">{current.why}</p>
        </div>
        <div className="relative mt-6 border-t border-white/20 pt-5">
          {matches.length ? (
            <ul className="flex flex-wrap gap-2">
              {matches.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={p.href}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[oklch(0.35_0.2_265)] shadow-lg shadow-black/15 transition-transform hover:-translate-y-0.5"
                  >
                    {p.name}
                    <span className="text-xs font-medium opacity-70 tabular-nums">
                      {p.availableCount}/{p.serverCount} open
                    </span>
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/80">
              No {current.family.split(" (")[0]} service is published here right now. This is general advice; check the catalogue or server status later.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
