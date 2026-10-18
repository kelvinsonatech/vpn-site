import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { ToolError } from "./errors";
import { isPublicAddress, parseHostname } from "./hostname";

/**
 * "IP to Hostname" tool: the reverse DNS (PTR) names of a public IP address, each checked forwards
 * (does the name point back to the same IP?), and the network the address belongs to (owner, ASN,
 * country, range) from Team Cymru's public IP-to-ASN DNS service. Reverse DNS is whatever name the
 * address's owner set: for shared hosting and CDNs that is the provider, not the websites on it, so
 * the owner is shown alongside. Plain DNS queries; nothing connects to the address. Private and
 * reserved addresses are refused: our own resolver could otherwise reveal internal names.
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
  /** Empty when no reverse DNS is set for the address. */
  hostnames: ReverseHostname[];
  network: IpNetwork | null;
}

const MAX_NAMES = 10;
const MAX_CONFIRM = 5;

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

export async function reverseLookup(ip: string): Promise<ReverseLookup> {
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  const [ptr, network] = await Promise.all([resolver.reverse(ip).then((names) => ({ names }), (e: { code?: string }) => ({ error: e.code })), networkOf(resolver, ip)]);
  if ("error" in ptr && !NO_NAME.has(ptr.error ?? "")) throw new ToolError("DNS_FAILED", 502, "The DNS lookup didn't answer in time. Please try again.");
  const names = "names" in ptr ? ptr.names : [];
  const unique = [...new Set(names.map((n) => n.replace(/\.$/, "").toLowerCase()).filter(Boolean))].slice(0, MAX_NAMES);
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
  return { ip, hostnames: unique.map((name, i) => ({ name, confirmed: confirmed[i] ?? false })), network };
}
