import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { ToolError } from "./errors";
import { isPublicAddress, parseHostname } from "./hostname";

/**
 * "IP to Hostname" tool. Three answers for a public IP address:
 *  - websites on it: hostnames people looked up with "Hostname to IP" that pointed here (the caller
 *    passes them in), each re-checked in DNS now and listed only if it still points here;
 *  - its reverse DNS (PTR) names, each checked forwards (does the name point back to the same IP?).
 *    That is whatever name the address's owner set: for shared hosting and CDNs, the provider;
 *  - the network it belongs to (owner, ASN, country, range) from Team Cymru's IP-to-ASN DNS service.
 * Plain DNS queries; nothing connects to the address. Private and reserved addresses are refused: our
 * own resolver could otherwise reveal internal names.
 */

export type ParsedIp = { ok: true; ip: string } | { ok: false; reason: "empty" | "hostname" | "invalid" | "private"; ip?: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** "2001:DB8:0:0::1" → "2001:db8::1" (the form DNS answers use), IPv4 unchanged. */
export function canonical(ip: string): string {
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

export interface IpNetwork {
  asn: number;
  /** The AS (network) name, e.g. "RENDER" or "CLOUDFLARENET"; empty when unknown. */
  name: string;
  /** The announced address range, e.g. "216.24.56.0/21". */
  prefix: string;
  /** ISO country code of the registration, or null. */
  country: string | null;
}

export interface ReverseLookup {
  ip: string;
  /** Websites that point to this IP right now (checked during this lookup). */
  websites: string[];
  /** Reverse DNS names; empty when none is set for the address (or when the query failed, see below). */
  hostnames: ReverseHostname[];
  /** The reverse DNS query got no answer (timeout, SERVFAIL), so `hostnames` is unknown rather than none. */
  reverseDnsFailed: boolean;
  network: IpNetwork | null;
}

const MAX_NAMES = 10;
const MAX_CONFIRM = 5;
/** Remembered website names checked per lookup (most recently seen first), all at once. */
export const MAX_WEBSITE_CHECKS = 24;

/** "2001:db8::1" → "1.0.0.0…8.b.d.0.1.0.0.2" (the 32 nibbles reversed, as reverse-DNS style names use). */
function nibbles(ip: string): string {
  const [head = "", tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  return groups
    .map((g) => g.padStart(4, "0"))
    .join("")
    .split("")
    .reverse()
    .join(".");
}

const firstTxt = async (resolver: Resolver, name: string) => (await resolver.resolveTxt(name)).map((r) => r.join(""))[0] ?? "";

/** The network an address is announced from, via Team Cymru (origin TXT, then the AS name). Null when unknown. */
async function networkOf(resolver: Resolver, ip: string): Promise<IpNetwork | null> {
  const query = isIP(ip) === 6 ? `${nibbles(ip)}.origin6.asn.cymru.com` : `${ip.split(".").reverse().join(".")}.origin.asn.cymru.com`;
  try {
    // "397273 | 216.24.56.0/21 | US | arin | 2020-03-12" (several origin ASNs are space-separated).
    const [asns = "", prefix = "", cc = ""] = (await firstTxt(resolver, query)).split("|").map((f) => f.trim());
    const asn = Number(asns.split(/\s+/)[0]);
    if (!Number.isInteger(asn) || asn <= 0) return null;
    let name = "";
    try {
      // "397273 | US | arin | 2020-03-12 | RENDER, US"
      name = ((await firstTxt(resolver, `AS${asn}.asn.cymru.com`)).split("|")[4] ?? "").trim().replace(/,\s*[A-Z]{2}$/, "");
    } catch {}
    return { asn, name, prefix, country: /^[A-Z]{2}$/.test(cc) ? cc : null };
  } catch {
    return null;
  }
}

const NO_NAME = new Set(["ENOTFOUND", "ENODATA"]);

/** A remembered name, checked now: points here, conclusively doesn't (moved or gone), or no answer. */
type Check = "here" | "elsewhere" | "unknown";

/**
 * Looks `ip` up. `stale` lists the candidates DNS says no longer point here, for the caller to forget;
 * it is never part of the answer. The reverse DNS query failing (rather than finding no name) only
 * fails the lookup when nothing else was found either.
 */
export async function reverseLookup(ip: string, candidates: string[] = []): Promise<{ lookup: ReverseLookup; stale: string[] }> {
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  // Website checks get a quick resolver of their own: one slow name can't hold the whole answer up.
  const quick = new Resolver({ timeout: 1500, tries: 1 });
  const v6 = isIP(ip) === 6;
  const check = async (r: Resolver, name: string): Promise<Check> => {
    try {
      const addresses = v6 ? await r.resolve6(name) : await r.resolve4(name);
      return addresses.some((a) => canonical(a) === ip) ? "here" : "elsewhere";
    } catch (e) {
      return NO_NAME.has((e as { code?: string }).code ?? "") ? "elsewhere" : "unknown";
    }
  };
  const toCheck = [...new Set(candidates)].slice(0, MAX_WEBSITE_CHECKS);
  const [ptr, network, checks] = await Promise.all([
    resolver.reverse(ip).then(
      (names) => ({ names, failed: false }),
      (e: { code?: string }) => ({ names: [] as string[], failed: !NO_NAME.has(e.code ?? "") }),
    ),
    networkOf(resolver, ip),
    Promise.all(toCheck.map((name) => check(quick, name))),
  ]);
  const unique = [...new Set(ptr.names.map((n) => n.replace(/\.$/, "").toLowerCase()).filter(Boolean))].slice(0, MAX_NAMES);
  const confirmed = await Promise.all(unique.slice(0, MAX_CONFIRM).map(async (name) => (await check(resolver, name)) === "here"));
  const websites = toCheck.filter((name, i) => checks[i] === "here" && !unique.includes(name)).sort();
  if (ptr.failed && !websites.length && !network) throw new ToolError("DNS_FAILED", 502, "The DNS lookup didn't answer in time. Please try again.");
  return {
    lookup: { ip, websites, hostnames: unique.map((name, i) => ({ name, confirmed: confirmed[i] ?? false })), reverseDnsFailed: ptr.failed, network },
    stale: toCheck.filter((_, i) => checks[i] === "elsewhere"),
  };
}
