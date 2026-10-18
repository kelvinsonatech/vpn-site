import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { ToolError } from "./errors";
import { isPublicAddress, parseHostname } from "./hostname";

/**
 * "IP to Hostname" tool: the reverse DNS (PTR) names of a public IP address, each checked forwards
 * (does the name point back to the same IP?). Plain DNS queries; nothing connects to the address.
 * Private and reserved addresses are refused: our own resolver could otherwise reveal internal names.
 */

export type ParsedIp = { ok: true; ip: string } | { ok: false; reason: "empty" | "hostname" | "invalid" | "private"; ip?: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** "2001:DB8:0:0::1" → "2001:db8::1" (the form DNS answers use), IPv4 unchanged. */
function canonical(ip: string): string {
  return isIP(ip) === 6 ? new URL(`http://[${ip}]`).hostname.slice(1, -1) : ip;
}

/** "8.8.8.8", " 8.8.8.8:443 ", "[2606:4700::1111]", "http://1.1.1.1/path" and "::ffff:8.8.8.8" are all accepted. */
export function parseIpInput(raw: string): ParsedIp {
  let s = raw.trim();
  if (!s) return { ok: false, reason: "empty" };
  if (SCHEME.test(s) || s.includes("/")) {
    try {
      s = new URL(SCHEME.test(s) ? s : `http://${s}`).hostname;
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
  s = s.replace(/^\[(.*)\]$/, "$1").replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/, "$1");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(s);
  if (mapped) s = mapped[1]!;
  if (!isIP(s)) return { ok: false, reason: parseHostname(s).ok ? "hostname" : "invalid" };
  const ip = canonical(s);
  if (!isPublicAddress(ip)) return { ok: false, reason: "private", ip };
  return { ok: true, ip };
}

export interface ReverseHostname {
  name: string;
  /** The name resolves back to the same IP (forward-confirmed reverse DNS). */
  confirmed: boolean;
}

export interface ReverseLookup {
  ip: string;
  hostnames: ReverseHostname[];
}

const MAX_NAMES = 10;
const MAX_CONFIRM = 5;

export async function reverseLookup(ip: string): Promise<ReverseLookup> {
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  let names: string[];
  try {
    names = await resolver.reverse(ip);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA") throw new ToolError("NO_HOSTNAME", 404, `${ip} has no hostname: no reverse DNS is set for it.`);
    throw new ToolError("DNS_FAILED", 502, "The DNS lookup didn't answer in time. Please try again.");
  }
  const unique = [...new Set(names.map((n) => n.replace(/\.$/, "").toLowerCase()).filter(Boolean))].slice(0, MAX_NAMES);
  if (!unique.length) throw new ToolError("NO_HOSTNAME", 404, `${ip} has no hostname: no reverse DNS is set for it.`);
  const v6 = isIP(ip) === 6;
  const confirmed = await Promise.all(
    unique.slice(0, MAX_CONFIRM).map(async (name) => {
      try {
        const addresses = v6 ? await resolver.resolve6(name) : await resolver.resolve4(name);
        return addresses.some((a) => canonical(a) === ip);
      } catch {
        return false;
      }
    }),
  );
  return { ip, hostnames: unique.map((name, i) => ({ name, confirmed: confirmed[i] ?? false })) };
}
