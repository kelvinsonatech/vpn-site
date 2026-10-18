import { connect } from "node:net";
import { logger } from "@/server/logging/logger";
import { registrableDomain } from "./domain-name";
import { ToolError } from "./errors";

/**
 * "Domain Age" tool: when a domain was registered, when it expires and who its registrar is, from
 * the registry's public record. RDAP (the JSON successor to WHOIS) is used wherever the registry
 * offers it, found through IANA's bootstrap list; registries without RDAP (.io, .co, .me ...) are
 * asked over classic WHOIS. Only the registry is contacted, never the domain itself, and contact
 * details in the record are never read.
 */

export interface DomainAge {
  /** The registered domain the record is for (e.g. "example.co.uk" for "www.example.co.uk"). */
  domain: string;
  /** ISO dates; null when the registry doesn't publish them. */
  registered: string | null;
  expires: string | null;
  updated: string | null;
  registrar: string | null;
  nameservers: string[];
  /** Registry status flags as published ("client transfer prohibited", "active", ...). */
  status: string[];
  /** Whether the domain is DNSSEC-signed at the registry; null when unknown. */
  dnssec: boolean | null;
  source: "rdap" | "whois";
}

const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const IANA_WHOIS = "whois.iana.org";
const DAY_MS = 86_400_000;
const LIST_TTL_MS = DAY_MS;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 2;
const MAX_NAMESERVERS = 13;
const MAX_STATUS = 12;
const USER_AGENT = "LitronSSH-DomainAge/1.0";

const notRegistered = (domain: string) =>
  new ToolError("NOT_REGISTERED", 404, `No registration was found for ${domain}. It may not be registered.`);
const registryFailed = () => new ToolError("REGISTRY_FAILED", 502, "The domain registry didn't answer in time. Please try again.");
const registryBusy = () => new ToolError("REGISTRY_BUSY", 503, "The domain registry is limiting lookups right now. Please try again in a few minutes.");

/* ---------------------------------------------------------------- dates */

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/**
 * A registry date as ISO, or null. Accepts RFC 3339 (any fraction digits) and the common WHOIS
 * spellings: "2001-01-13 00:12:14", "13-Jan-2001", "2001.01.13", "2001/01/13", "13.01.2001".
 * Times without a zone are taken as UTC. Implausible years are rejected.
 */
export function parseRegistryDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw
    .trim()
    .replace(/\s*\(?(UTC|GMT|Z)\)?$/i, "Z")
    .replace(/\s+/g, " ");
  let ms = NaN;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)? ?(Z|[+-]\d{2}:?\d{2})?$/i.exec(s))) {
    const [, y, mo, d, h = "0", mi = "0", sec = "0", fraction = "0", zone] = m;
    ms = Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +sec, Math.floor(Number(`0.${fraction}`) * 1000));
    if (zone && zone.toUpperCase() !== "Z") {
      const z = /^([+-])(\d{2}):?(\d{2})$/.exec(zone)!;
      ms -= (z[1] === "-" ? -1 : 1) * (+z[2]! * 60 + +z[3]!) * 60_000;
    }
  } else if ((m = /^(\d{1,2})-([a-z]{3})-(\d{4})/i.exec(s)) && MONTHS[m[2]!.toLowerCase()] !== undefined) {
    ms = Date.UTC(+m[3]!, MONTHS[m[2]!.toLowerCase()]!, +m[1]!);
  } else if ((m = /^(\d{4})[./](\d{2})[./](\d{2})/.exec(s))) {
    ms = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
  } else if ((m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s))) {
    ms = Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!);
  }
  if (!Number.isFinite(ms)) return null;
  const year = new Date(ms).getUTCFullYear();
  return year >= 1984 && year <= new Date().getUTCFullYear() + 100 ? new Date(ms).toISOString() : null;
}

/* ---------------------------------------------------------------- fetching */

/** A registry URL we're willing to follow: http(s) to a named host on the default port. */
function allowedUrl(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.port || u.username || u.password) return false;
  const host = u.hostname;
  return host.includes(".") && !/^[\d.]+$/.test(host) && !host.startsWith("[") && !/(^|\.)localhost$/i.test(host);
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw registryFailed();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** GET with a timeout, a size cap and at most MAX_REDIRECTS redirects, each re-checked. */
async function fetchText(url: string, accept: string, maxBytes: number): Promise<{ status: number; body: string }> {
  let current = new URL(url);
  for (let hop = 0; ; hop++) {
    if (!allowedUrl(current)) throw registryFailed();
    const res = await fetch(current, { headers: { accept, "user-agent": USER_AGENT }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      if (hop >= MAX_REDIRECTS) throw registryFailed();
      current = new URL(location, current);
      continue;
    }
    return { status: res.status, body: await readCapped(res, maxBytes) };
  }
}

/* ---------------------------------------------------------------- RDAP */

let bootstrap: { at: number; services: Map<string, string> } | null = null;

/** IANA's TLD → RDAP base URL list, kept for a day (a stale copy is used if a refresh fails). */
async function rdapServices(): Promise<Map<string, string>> {
  if (bootstrap && Date.now() - bootstrap.at < LIST_TTL_MS) return bootstrap.services;
  try {
    const { status, body } = await fetchText(BOOTSTRAP_URL, "application/json", 1_000_000);
    if (status !== 200) throw new Error(`bootstrap ${status}`);
    const data = JSON.parse(body) as { services?: [string[], string[]][] };
    const services = new Map<string, string>();
    for (const [tlds, urls] of data.services ?? []) {
      const url = urls.find((u) => u.startsWith("https://")) ?? urls.find((u) => u.startsWith("http://"));
      if (url) for (const tld of tlds) services.set(tld.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
    }
    if (!services.size) throw new Error("empty bootstrap");
    bootstrap = { at: Date.now(), services };
  } catch (e) {
    if (!bootstrap) throw e instanceof ToolError ? e : registryFailed();
    logger.warn("rdap bootstrap refresh failed, using the cached list", { error: (e as Error).name });
  }
  return bootstrap.services;
}

/** The RDAP base URL for a domain: the longest matching suffix in the bootstrap list. */
function rdapBaseFor(services: Map<string, string>, domain: string): string | null {
  const labels = domain.split(".");
  for (let i = 1; i < labels.length; i++) {
    const base = services.get(labels.slice(i).join("."));
    if (base) return base;
  }
  return null;
}

type RdapEntity = { roles?: unknown; vcardArray?: unknown; entities?: unknown };
type RdapDomain = {
  ldhName?: unknown;
  events?: unknown;
  entities?: unknown;
  nameservers?: unknown;
  status?: unknown;
  secureDNS?: { delegationSigned?: unknown };
};

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The "fn" (full name) of an RDAP entity's vCard. */
function vcardName(entity: RdapEntity): string | null {
  const card = asArray(entity.vcardArray)[1];
  for (const prop of asArray(card)) {
    const p = asArray(prop);
    if (p[0] === "fn" && typeof p[3] === "string" && p[3].trim()) return p[3].trim().slice(0, 120);
  }
  return null;
}

/** Turns an RDAP domain answer into a DomainAge (registrar name only, never contacts). */
export function parseRdap(json: unknown, fallbackDomain: string): DomainAge {
  const d = (json ?? {}) as RdapDomain;
  const events = new Map<string, string>();
  for (const e of asArray(d.events)) {
    const { eventAction, eventDate } = (e ?? {}) as { eventAction?: unknown; eventDate?: unknown };
    if (typeof eventAction === "string" && typeof eventDate === "string" && !events.has(eventAction.toLowerCase())) {
      events.set(eventAction.toLowerCase(), eventDate);
    }
  }
  const registrarEntity = asArray(d.entities).find((e) => asArray((e as RdapEntity)?.roles).includes("registrar")) as RdapEntity | undefined;
  const nameservers = asArray(d.nameservers)
    .map((n) => (n as { ldhName?: unknown })?.ldhName)
    .filter((n): n is string => typeof n === "string")
    .map((n) => n.toLowerCase().replace(/\.$/, ""));
  const signed = d.secureDNS?.delegationSigned;
  return {
    domain: typeof d.ldhName === "string" ? d.ldhName.toLowerCase().replace(/\.$/, "") : fallbackDomain,
    registered: parseRegistryDate(events.get("registration")),
    expires: parseRegistryDate(events.get("expiration") ?? events.get("registrar expiration")),
    updated: parseRegistryDate(events.get("last changed")),
    registrar: registrarEntity ? vcardName(registrarEntity) : null,
    nameservers: [...new Set(nameservers)].slice(0, MAX_NAMESERVERS),
    status: asArray(d.status)
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.slice(0, 60))
      .slice(0, MAX_STATUS),
    dnssec: typeof signed === "boolean" ? signed : null,
    source: "rdap",
  };
}

async function rdapLookup(base: string, domain: string): Promise<DomainAge | null> {
  const { status, body } = await fetchText(`${base}domain/${encodeURIComponent(domain)}`, "application/rdap+json, application/json", 512_000);
  if (status === 404) return null;
  if (status === 429) throw registryBusy();
  if (status !== 200) throw registryFailed();
  try {
    return parseRdap(JSON.parse(body), domain);
  } catch {
    throw registryFailed();
  }
}

/* ---------------------------------------------------------------- WHOIS */

const whoisServers = new Map<string, { at: number; server: string | null }>();
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** One WHOIS query over TCP port 43: the whole answer, capped at 256 KB. */
export function whoisQuery(host: string, query: string): Promise<string> {
  if (!HOSTNAME.test(host)) return Promise.reject(registryFailed());
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: 43 });
    const chunks: Buffer[] = [];
    let size = 0;
    const fail = () => {
      socket.destroy();
      reject(registryFailed());
    };
    socket.setTimeout(TIMEOUT_MS, fail);
    socket.on("error", fail);
    socket.on("connect", () => socket.end(`${query}\r\n`));
    socket.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 256_000) return fail();
      chunks.push(chunk);
    });
    socket.on("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

/** The WHOIS server IANA lists for a TLD (null when there is none), kept for a day. */
async function whoisServerFor(tld: string): Promise<string | null> {
  const cached = whoisServers.get(tld);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.server;
  const answer = await whoisQuery(IANA_WHOIS, tld);
  const server = /^whois:\s*(\S+)/im.exec(answer)?.[1]?.toLowerCase() ?? null;
  whoisServers.set(tld, { at: Date.now(), server: server && HOSTNAME.test(server) ? server : null });
  return whoisServers.get(tld)!.server;
}

const WHOIS_KEYS = {
  registered: ["creation date", "created", "created on", "created date", "registered on", "registered", "registration date", "registration time", "domain registration date", "domain create date", "record created", "commencement date"],
  expires: ["registry expiry date", "expiry date", "expiration date", "expires", "expires on", "expire date", "paid-till", "renewal date", "domain expiration date", "record expires", "registrar registration expiration date"],
  updated: ["updated date", "last updated", "last modified", "last update", "changed", "modified"],
  registrar: ["registrar", "registrar name", "sponsoring registrar"],
  nameservers: ["name server", "name servers", "nserver", "nameserver", "nameservers"],
  status: ["domain status", "status"],
};
const NOT_FOUND = /no match|not found|no entries found|no data found|no object found|status:\s*(free|available)|is available for registration/i;
const BUSY = /limit exceeded|quota exceeded|too many (queries|requests)|query rate/i;

/**
 * Reads the useful lines of a WHOIS answer ("Key: value"; a value on the following indented line
 * also counts, as some registries write it). Contact details are never read. Returns null when the
 * registry says the domain doesn't exist.
 */
export function parseWhois(text: string, domain: string): DomainAge | null {
  const fields = new Map<string, string[]>();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*([A-Za-z][A-Za-z /.-]{1,40}?)\s*:\s*(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const key = m[1]!.toLowerCase().replace(/\s+/g, " ");
    let value = m[2]!.trim();
    if (!value && /^\s+\S/.test(lines[i + 1] ?? "") && !/:\s*$/.test(lines[i + 1]!)) value = lines[i + 1]!.trim();
    if (value) fields.set(key, [...(fields.get(key) ?? []), value]);
  }
  const first = (keys: string[]) => keys.map((k) => fields.get(k)?.[0]).find(Boolean) ?? null;
  const all = (keys: string[]) => keys.flatMap((k) => fields.get(k) ?? []);
  const registered = parseRegistryDate(first(WHOIS_KEYS.registered));
  if (!registered && NOT_FOUND.test(text)) return null;
  const registrar = first(WHOIS_KEYS.registrar);
  return {
    domain,
    registered,
    expires: parseRegistryDate(first(WHOIS_KEYS.expires)),
    updated: parseRegistryDate(first(WHOIS_KEYS.updated)),
    registrar: registrar && !/^https?:/i.test(registrar) ? registrar.slice(0, 120) : null,
    nameservers: [...new Set(all(WHOIS_KEYS.nameservers).map((n) => n.split(/\s+/)[0]!.toLowerCase().replace(/\.$/, "")))]
      .filter((n) => HOSTNAME.test(n))
      .slice(0, MAX_NAMESERVERS),
    status: [...new Set(all(WHOIS_KEYS.status).map((s) => s.split(/\s+(?=https?:)/)[0]!.trim()))].filter(Boolean).map((s) => s.slice(0, 60)).slice(0, MAX_STATUS),
    dnssec: /^dnssec:\s*(signed|yes)/im.test(text) ? true : /^dnssec:\s*(unsigned|no)/im.test(text) ? false : null,
    source: "whois",
  };
}

async function whoisLookup(server: string, domain: string): Promise<DomainAge | null> {
  // DENIC answers nothing useful to a bare name; it wants the "-T dn" form.
  const answer = await whoisQuery(server, server === "whois.denic.de" ? `-T dn ${domain}` : domain);
  if (BUSY.test(answer) && !/creat|regist/i.test(answer)) throw registryBusy();
  return parseWhois(answer, domain);
}

/* ---------------------------------------------------------------- lookup */

const results = new Map<string, { at: number; value: DomainAge | null }>();
const RESULT_TTL_MS = 30 * 60_000;
const MISS_TTL_MS = 5 * 60_000;
const MAX_RESULTS = 500;

function remember(domain: string, value: DomainAge | null) {
  if (results.size >= MAX_RESULTS) results.delete(results.keys().next().value!);
  results.set(domain, { at: Date.now(), value });
}

async function lookupOne(domain: string): Promise<DomainAge | null> {
  const hit = results.get(domain);
  if (hit && Date.now() - hit.at < (hit.value ? RESULT_TTL_MS : MISS_TTL_MS)) return hit.value;
  const base = rdapBaseFor(await rdapServices(), domain);
  let value: DomainAge | null;
  if (base) {
    value = await rdapLookup(base, domain);
  } else {
    const tld = domain.split(".").at(-1)!;
    const server = await whoisServerFor(tld);
    if (!server) throw new ToolError("NO_REGISTRY_SERVICE", 422, `The registry for .${tld} doesn't offer a public lookup service, so this domain's age can't be checked.`);
    value = await whoisLookup(server, domain);
  }
  remember(domain, value);
  return value;
}

/**
 * Looks up the registered domain behind a hostname (already validated by parseHostname). When the
 * registry doesn't know the first guess at the registered domain ("example.ltd.uk" guessed as
 * "ltd.uk"), the name one label longer is tried once.
 */
export async function lookupDomainAge(hostname: string): Promise<DomainAge> {
  const guess = registrableDomain(hostname);
  const labels = hostname.split(".");
  const guessLabels = guess.split(".").length;
  const candidates = [guess, ...(labels.length > guessLabels ? [labels.slice(-(guessLabels + 1)).join(".")] : [])];
  try {
    for (const domain of candidates) {
      const found = await lookupOne(domain);
      if (found) return found;
    }
  } catch (e) {
    if (e instanceof ToolError) {
      if (e.code === "REGISTRY_FAILED" || e.code === "REGISTRY_BUSY") logger.warn("domain age lookup failed", { tld: guess.split(".").at(-1), code: e.code });
      throw e;
    }
    logger.warn("domain age lookup failed", { tld: guess.split(".").at(-1), error: (e as Error)?.name });
    throw registryFailed();
  }
  throw notRegistered(guess);
}

/** Tests: forget cached lists and results. */
export function resetDomainAgeCaches() {
  bootstrap = null;
  whoisServers.clear();
  results.clear();
}
