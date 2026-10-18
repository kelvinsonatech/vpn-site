import { GlobeIcon, NetworkIcon } from "lucide-react";

/** The public tools, in menu order: the /tools page, the header and the phone menu list them from here. */
export const TOOLS = [
  {
    slug: "hostname-to-ip",
    href: "/tools/hostname-to-ip",
    name: "Hostname to IP",
    description: "Find the IPv4 and IPv6 addresses behind any hostname or link.",
    icon: NetworkIcon,
  },
  {
    slug: "ip-to-hostname",
    href: "/tools/ip-to-hostname",
    name: "IP to Hostname",
    description: "Find the hostname (reverse DNS) of any IPv4 or IPv6 address.",
    icon: GlobeIcon,
  },
] as const;

export type ToolEntry = (typeof TOOLS)[number];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
