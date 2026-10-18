import { CalendarClockIcon, GlobeIcon, NetworkIcon } from "lucide-react";
import hostnameToIpImage from "@/assets/hostname-to-ip.webp";
import ipToHostnameImage from "@/assets/ip-to-hostname.webp";

/**
 * The public tools, in menu order: the /tools page lists them from here. `image`, when set, is the
 * tool's picture (shown instead of the line icon on its card and page header).
 */
export const TOOLS = [
  {
    slug: "hostname-to-ip",
    href: "/tools/hostname-to-ip",
    name: "Hostname to IP",
    description: "Find the IPv4 and IPv6 addresses behind any hostname or link.",
    icon: NetworkIcon,
    image: hostnameToIpImage,
  },
  {
    slug: "ip-to-hostname",
    href: "/tools/ip-to-hostname",
    name: "IP to Hostname",
    description: "Find the hostname (reverse DNS) of any IPv4 or IPv6 address.",
    icon: GlobeIcon,
    image: ipToHostnameImage,
  },
  {
    slug: "domain-age",
    href: "/tools/domain-age",
    name: "Domain Age Checker",
    description: "See how old a domain is, when it was registered and when it expires.",
    icon: CalendarClockIcon,
    image: null,
  },
] as const;

export type ToolEntry = (typeof TOOLS)[number];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
