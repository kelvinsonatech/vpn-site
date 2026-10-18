import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { isRestrictedAddress } from "@/server/nodes/net-guard";
import { ToolError } from "./errors";

/**
 * "Hostname to IP" tool: turns a hostname (or a pasted link) into its IPv4 and IPv6 addresses with a
 * plain DNS lookup. Nothing connects to the host itself, so the tool can't be used to reach it.
 */

/** Public internet address (not private, loopback, link-local, CGNAT, test or multicast): the node SSRF guard's list. */
export function isPublicAddress(ip: string): boolean {
  return !isRestrictedAddress(ip);
}

export type ParsedHostname = { ok: true; hostname: string } | { ok: false; reason: "empty" | "ip" | "invalid"; ip?: string };

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * "Example.COM", "https://www.example.com/page?x=1", "example.com:8443" and "bücher.de" all become a
 * lower-case ASCII hostname. IP addresses are reported as such (there is nothing to convert).
 */
export function parseHostname(raw: string): ParsedHostname {
  let s = raw.trim();
  if (!s) return { ok: false, reason: "empty" };
  if (SCHEME.test(s) || s.includes("/") || s.includes("@")) {
    try {
      s = new URL(SCHEME.test(s) ? s : `http://${s}`).hostname;
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
  const bare = s.replace(/^\[(.*)\]$/, "$1");
  if (isIP(bare)) return { ok: false, reason: "ip", ip: bare };
  s = s.replace(/:\d{1,5}$/, "").replace(/\.$/, "").toLowerCase();
  const ascii = domainToASCII(s);
  if (!ascii || ascii.length > 253) return { ok: false, reason: "invalid" };
  const labels = ascii.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || /^\d+$/.test(labels.at(-1)!)) return { ok: false, reason: "invalid" };
  return { ok: true, hostname: ascii };
}

export interface ResolvedAddress {
  address: string;
  /** Seconds the answer may be cached for. */
  ttl: number;
  public: boolean;
}

export interface HostnameLookup {
  hostname: string;
  /** The name this hostname is an alias (CNAME) of, if any. */
  aliasOf: string | null;
  ipv4: ResolvedAddress[];
  ipv6: ResolvedAddress[];
}

const MAX_ADDRESSES = 32;

function addresses(result: PromiseSettledResult<{ address: string; ttl: number }[]>): ResolvedAddress[] {
  if (result.status !== "fulfilled") return [];
  const seen = new Set<string>();
  return result.value
    .filter((r) => !seen.has(r.address) && seen.add(r.address))
    .slice(0, MAX_ADDRESSES)
    .map((r) => ({ address: r.address, ttl: r.ttl, public: isPublicAddress(r.address) }));
}

const errorCode = (r: PromiseSettledResult<unknown>) => (r.status === "rejected" ? (r.reason as { code?: string })?.code : undefined);

export async function lookupHostname(hostname: string): Promise<HostnameLookup> {
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  const [v4, v6, cname] = await Promise.allSettled([
    resolver.resolve4(hostname, { ttl: true }),
    resolver.resolve6(hostname, { ttl: true }),
    resolver.resolveCname(hostname),
  ]);
  const ipv4 = addresses(v4);
  const ipv6 = addresses(v6);
  if (ipv4.length || ipv6.length) {
    return { hostname, aliasOf: cname.status === "fulfilled" ? (cname.value[0] ?? null) : null, ipv4, ipv6 };
  }
  const codes = [errorCode(v4), errorCode(v6)];
  if (codes.includes("ENOTFOUND")) throw new ToolError("NOT_FOUND", 404, `${hostname} doesn't exist (the domain isn't registered or has no DNS).`);
  if (codes.every((c) => c === "ENODATA" || c === undefined)) {
    throw new ToolError("NO_ADDRESSES", 404, `${hostname} exists but doesn't point to any IP address.`);
  }
  throw new ToolError("DNS_FAILED", 502, "The DNS lookup didn't answer in time. Please try again.");
}
