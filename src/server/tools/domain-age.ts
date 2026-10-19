import { connect } from "node:net";
import { domainToASCII } from "node:url";
import { rateLimit } from "@/server/auth/rate-limit";
import { logger } from "@/server/logging/logger";
import { registrableDomain } from "./domain-name";
import { ToolError } from "./errors";

/**
 * "Domain Age" tool: when a domain was registered, when it expires and who its registrar is, from
 * the registry's public record. RDAP (the JSON successor to WHOIS) is used wherever the registry
 * offers it, found through IANA's bootstrap list; registries without RDAP (.io, .co, .me ...) are
 * asked over classic WHOIS. Only the registry is contacted, never the domain itself, and contact
 * details in the record are never read.
 *
 * Registries are shared, rate-limited services, so every outbound query passes a global per-host
 * budget (failing closed), a registry that answers "slow down" is left alone for a while, and
 * concurrent lookups of the same name share one query.
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
const SUFFIX_LIST_URL = "https://publicsuffix.org/list/public_suffix_list.dat";
const IANA_WHOIS = "whois.iana.org";
const DAY_MS = 86_400_000;
const LIST_TTL_MS = DAY_MS;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 2;
const MAX_NAMESERVERS = 13;
const MAX_STATUS = 12;
const USER_AGENT = "LitronSSH-DomainAge/1.0";
/** Queries per minute to one registry host, across all visitors. */
const RDAP_PER_MINUTE = 60;
const WHOIS_PER_MINUTE = 20;

const notRegistered = (domain: string) =>
  new ToolError("NOT_REGISTERED", 404, `No registration was found for ${domain}. It may not be registered.`);
const registryFailed = () => new ToolError("REGISTRY_FAILED", 502, "The domain registry didn't answer in time. Please try again.");
const registryBusy = () => new ToolError("REGISTRY_BUSY", 503, "The domain registry is limiting lookups right now. Please try again in a few minutes.");
const unknownTld = (tld: string) => new ToolError("UNKNOWN_TLD", 400, `.${tld} isn't a real domain ending, so there is nothing to look up. Check the spelling.`);

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
  if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)? ?(Z|[+-]\d{2}(?::?\d{2})?)?$/i.exec(s))) {
    const [, y, mo, d, h = "0", mi = "0", sec = "0", fraction = "0", zone] = m;
    ms = Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +sec, Math.floor(Number(`0.${fraction}`) * 1000));
    if (zone && zone.toUpperCase() !== "Z") {
      const z = /^([+-])(\d{2}):?(\d{2})?$/.exec(zone)!;
      ms -= (z[1] === "-" ? -1 : 1) * (+z[2]! * 60 + +(z[3] ?? 0)) * 60_000;
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

/* ---------------------------------------------------------------- registry etiquette */

const cooldowns = new Map<string, number>();

/** Passes when `host` may be queried now: not cooling down, and within its global per-minute budget. */
async function allowQuery(host: string, perMinute: number): Promise<void> {
  const until = cooldowns.get(host);
  if (until && until > Date.now()) throw registryBusy();
  if (!(await rateLimit(`tools:domain-age:host:${host}`, perMinute, 60, "closed")).allowed) throw registryBusy();
}

/** A registry asked us to slow down: leave it alone for `seconds` (1 to 15 minutes). */
function coolDown(host: string, seconds = 120) {
  if (cooldowns.size >= 500) cooldowns.delete(cooldowns.keys().next().value!);
  cooldowns.set(host, Date.now() + Math.min(900, Math.max(60, seconds)) * 1000);
}

/* ---------------------------------------------------------------- fetching */

/** A registry URL we're willing to follow: http(s) to a named host on the default port. */
function allowedUrl(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.port || u.username || u.password) return false;
  const host = u.hostname;
  return host.includes(".") && !/^[\d.]+$/.test(host) && !host.startsWith("[") && !/(^|\.)localhost\.?$/i.test(host);
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
async function fetchText(url: string, accept: string, maxBytes: number): Promise<{ status: number; body: string; retryAfter: number | null }> {
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
    const retry = Number(res.headers.get("retry-after"));
    return { status: res.status, body: await readCapped(res, maxBytes), retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null };
  }
}

/**
 * A list fetched from the web and kept for a day. If a refresh fails, the stale copy (or nothing)
 * is used and the download isn't tried again for 5 minutes, so lookups don't each wait for it.
 */
function dailyList<T>(name: string, load: () => Promise<T>) {
  let cached: { at: number; value: T } | null = null;
  let failedAt = 0;
  let pending: Promise<T | null> | null = null;
  const refresh = async (): Promise<T | null> => {
    try {
      cached = { at: Date.now(), value: await load() };
    } catch (e) {
      failedAt = Date.now();
      logger.warn(`${name} refresh failed${cached ? ", using the cached copy" : ""}`, { error: (e as Error)?.name });
    }
    return cached?.value ?? null;
  };
  return {
    get(): Promise<T | null> {
      if (cached && Date.now() - cached.at < LIST_TTL_MS) return Promise.resolve(cached.value);
      if (Date.now() - failedAt < 5 * 60_000) return Promise.resolve(cached?.value ?? null);
      // One download at a time; lookups arriving meanwhile wait for it.
      pending ??= refresh().finally(() => (pending = null));
      return pending;
    },
    reset() {
      cached = null;
      failedAt = 0;
      pending = null;
    },
  };
}

/* ---------------------------------------------------------------- public suffixes */

export interface SuffixList {
  rules: Set<string>;
  wildcards: Set<string>;
  exceptions: Set<string>;
}

/** The ICANN section of the Public Suffix List ("co.uk", "*.ck", "!www.ck" ...), names in ASCII. */
export function parseSuffixList(text: string): SuffixList {
  const list: SuffixList = { rules: new Set(), wildcards: new Set(), exceptions: new Set() };
  for (const raw of text.split(/\r?\n/)) {
    if (raw.includes("===END ICANN DOMAINS===")) break;
    const line = raw.trim().split(/\s/)[0]!;
    if (!line || line.startsWith("//")) continue;
    const kind = line.startsWith("!") ? "exceptions" : line.startsWith("*.") ? "wildcards" : "rules";
    const name = domainToASCII(line.replace(/^!|^\*\./, ""));
    if (name) list[kind].add(name);
  }
  return list;
}

/**
 * The registered domain for a hostname by the Public Suffix List rules ("www.example.co.uk" →
 * "example.co.uk", "a.b.github.io" → "github.io"), or null when the name is itself a public suffix.
 */
export function registeredDomain(list: SuffixList, hostname: string): string | null {
  const labels = hostname.split(".");
  let suffixLength = 1; // the default "*" rule: the TLD alone
  for (let i = 0; i < labels.length; i++) {
    const name = labels.slice(i).join(".");
    if (list.exceptions.has(name)) {
      suffixLength = labels.length - i - 1;
      break;
    }
    if (list.rules.has(name) || (i + 1 < labels.length && list.wildcards.has(labels.slice(i + 1).join(".")))) {
      suffixLength = labels.length - i;
      break;
    }
  }
  return labels.length > suffixLength ? labels.slice(-(suffixLength + 1)).join(".") : null;
}

const suffixes = dailyList("public suffix list", async () => {
  const { status, body } = await fetchText(SUFFIX_LIST_URL, "text/plain", 2_000_000);
  if (status !== 200) throw new Error(`suffix list ${status}`);
  const list = parseSuffixList(body);
  if (list.rules.size < 1000) throw new Error("short suffix list");
  return list;
});

/* ---------------------------------------------------------------- RDAP */

const bootstrap = dailyList("rdap bootstrap", async () => {
  const { status, body } = await fetchText(BOOTSTRAP_URL, "application/json", 1_000_000);
  if (status !== 200) throw new Error(`bootstrap ${status}`);
  const data = JSON.parse(body) as { services?: [string[], string[]][] };
  const services = new Map<string, string>();
  for (const [tlds, urls] of data.services ?? []) {
    const url = urls.find((u) => u.startsWith("https://")) ?? urls.find((u) => u.startsWith("http://"));
    if (url) for (const tld of tlds) services.set(tld.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
  }
  if (!services.size) throw new Error("empty bootstrap");
  return services;
});

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
  const host = new URL(base).hostname;
  await allowQuery(host, RDAP_PER_MINUTE);
  const { status, body, retryAfter } = await fetchText(`${base}domain/${encodeURIComponent(domain)}`, "application/rdap+json, application/json", 512_000);
  if (status === 404) return null;
  if (status === 429) {
    coolDown(host, retryAfter ?? undefined);
    throw registryBusy();
  }
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

/**
 * The WHOIS server IANA lists for a TLD (null when the TLD has none), kept for a day. Only a real
 * TLD record is cached; an empty or odd answer fails the lookup (an expired entry is used instead
 * when there is one).
 */
async function whoisServerFor(tld: string): Promise<string | null> {
  const cached = whoisServers.get(tld);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.server;
  try {
    await allowQuery(IANA_WHOIS, WHOIS_PER_MINUTE);
    const answer = await whoisQuery(IANA_WHOIS, tld);
    if (/returned 0 objects/i.test(answer)) throw unknownTld(tld);
    if (!new RegExp(`^domain:\\s*${tld}\\s*$`, "im").test(answer)) throw registryFailed();
    const server = /^whois:\s*(\S+)/im.exec(answer)?.[1]?.toLowerCase() ?? null;
    if (whoisServers.size >= 2000) whoisServers.delete(whoisServers.keys().next().value!);
    whoisServers.set(tld, { at: Date.now(), server: server && HOSTNAME.test(server) ? server : null });
    return whoisServers.get(tld)!.server;
  } catch (e) {
    if (cached && !(e instanceof ToolError && e.code === "UNKNOWN_TLD")) return cached.server;
    throw e;
  }
}

const WHOIS_KEYS = {
  registered: [
    "creation date", "created", "created on", "created date", "registered on", "registered", "registered date", "registration date",
    "registration time", "domain registration date", "domain create date", "record created", "commencement date",
  ],
  expires: [
    "registry expiry date", "expiry date", "expiration date", "expiration time", "expires", "expires on", "expire", "expire date", "valid until",
    "paid-till", "renewal date", "domain expiration date", "record expires", "registrar registration expiration date",
  ],
  updated: ["updated date", "last updated", "last modified", "last update", "changed", "modified"],
  registrar: ["registrar", "registrar name", "sponsoring registrar"],
  nameservers: ["name server", "name servers", "nserver", "nameserver", "nameservers"],
  status: ["domain status", "status", "state"],
};
const NOT_FOUND = /no match|not found|no entries found|no data found|no object found|status:\s*(free|available|invalid)|is available for registration/i;
const BUSY = /limit (exceeded|reached)|quota exceeded|too many (queries|requests)|query rate|rate limit|access control|connection refused|interval is too short|try again later/i;
const KEY_VALUE = /^\s*([A-Za-z][A-Za-z /.-]{1,40}?)\s*:\s*(.*)$/;
/** JPRS (.jp) writes "[Created on]   2005/05/30" or "a. [Domain Name]   EXAMPLE.JP". */
const BRACKETED = /^\s*(?:[a-z]\.\s*)?\[([^\]]{2,40})\]\s+(\S.*)$/i;
const NESTED_NAME = new Set(["name", "organisation", "organization"]);

/**
 * Reads the useful lines of a WHOIS answer. Lines are "Key: value" (or JPRS's "[Key] value"); a key
 * with no value heads the indented lines below it, either a list ("Name servers:" then one per
 * line) or a block whose "Name:" is the value (EURid's "Registrar:" then "  Name: ..."). For each
 * field the earliest line wins, so the domain's own dates beat those of contact objects printed
 * after it. Contact details are never read. Returns null when the registry says the domain doesn't
 * exist.
 */
export function parseWhois(text: string, domain: string): DomainAge | null {
  const entries: { key: string; value: string; line: number }[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = KEY_VALUE.exec(lines[i]!) ?? BRACKETED.exec(lines[i]!);
    if (!m) continue;
    const key = m[1]!.toLowerCase().replace(/\s+/g, " ").trim();
    const value = m[2]!.trim();
    if (value) {
      entries.push({ key, value, line: i });
      continue;
    }
    for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]!); j++) {
      const nested = KEY_VALUE.exec(lines[j]!);
      if (!nested) entries.push({ key, value: lines[j]!.trim(), line: j });
      else if (NESTED_NAME.has(nested[1]!.toLowerCase().trim()) && nested[2]!.trim()) entries.push({ key, value: nested[2]!.trim(), line: j });
    }
  }
  entries.sort((a, b) => a.line - b.line);
  const values = (keys: string[]) => entries.filter((e) => keys.includes(e.key)).map((e) => e.value);
  const date = (keys: string[]) => values(keys).map(parseRegistryDate).find(Boolean) ?? null;
  const registered = date(WHOIS_KEYS.registered);
  if (!registered && NOT_FOUND.test(text)) return null;
  const registrar = values(WHOIS_KEYS.registrar).find((v) => !/^https?:/i.test(v)) ?? null;
  return {
    domain,
    registered,
    expires: date(WHOIS_KEYS.expires),
    updated: date(WHOIS_KEYS.updated),
    registrar: registrar ? registrar.slice(0, 120) : null,
    nameservers: [...new Set(values(WHOIS_KEYS.nameservers).map((n) => n.split(/\s+/)[0]!.toLowerCase().replace(/\.$/, "")))]
      .filter((n) => HOSTNAME.test(n))
      .slice(0, MAX_NAMESERVERS),
    status: [...new Set(values(WHOIS_KEYS.status).map((s) => s.split(/\s+(?=https?:)/)[0]!.trim()))].filter(Boolean).map((s) => s.slice(0, 60)).slice(0, MAX_STATUS),
    dnssec: /^dnssec:\s*(signed|yes)/im.test(text) ? true : /^dnssec:\s*(unsigned|no)/im.test(text) ? false : null,
    source: "whois",
  };
}

const isEmptyRecord = (r: DomainAge) => !r.registered && !r.expires && !r.updated && !r.registrar && !r.nameservers.length && !r.status.length;

async function whoisLookup(server: string, domain: string): Promise<DomainAge | null> {
  await allowQuery(server, WHOIS_PER_MINUTE);
  // DENIC answers nothing useful to a bare name (it wants "-T dn"); JPRS answers in English with "/e".
  const query = server === "whois.denic.de" ? `-T dn ${domain}` : server === "whois.jprs.jp" ? `${domain}/e` : domain;
  const answer = await whoisQuery(server, query);
  const record = parseWhois(answer, domain);
  // An empty or unrecognisable answer is a refusal (often a silent rate limit), not a record: never cache it.
  if (record && isEmptyRecord(record)) {
    if (BUSY.test(answer) || !answer.trim()) {
      coolDown(server);
      throw registryBusy();
    }
    throw registryFailed();
  }
  return record;
}

/* ---------------------------------------------------------------- lookup */

const results = new Map<string, { at: number; value: DomainAge | null }>();
const inflight = new Map<string, Promise<DomainAge | null>>();
const RESULT_TTL_MS = 30 * 60_000;
const MISS_TTL_MS = 5 * 60_000;
const MAX_RESULTS = 500;

function remember(domain: string, value: DomainAge | null) {
  if (results.size >= MAX_RESULTS) results.delete(results.keys().next().value!);
  results.set(domain, { at: Date.now(), value });
}

async function query(domain: string): Promise<DomainAge | null> {
  const services = await bootstrap.get();
  if (!services) throw registryFailed();
  const base = rdapBaseFor(services, domain);
  if (base) return rdapLookup(base, domain);
  const tld = domain.split(".").at(-1)!;
  const server = await whoisServerFor(tld);
  if (!server) throw new ToolError("NO_REGISTRY_SERVICE", 422, `The registry for .${tld} doesn't offer a public lookup service, so this domain's age can't be checked.`);
  return whoisLookup(server, domain);
}

/** One domain's record: from the cache, from a lookup already running, or fresh (then cached). */
function lookupOne(domain: string): Promise<DomainAge | null> {
  const hit = results.get(domain);
  if (hit && Date.now() - hit.at < (hit.value ? RESULT_TTL_MS : MISS_TTL_MS)) return Promise.resolve(hit.value);
  const running = inflight.get(domain);
  if (running) return running;
  const promise = query(domain)
    .then((value) => {
      remember(domain, value);
      return value;
    })
    .finally(() => inflight.delete(domain));
  inflight.set(domain, promise);
  return promise;
}

/**
 * Looks up the registered domain behind a hostname (already validated by parseHostname). The
 * registered domain comes from the Public Suffix List; if that list can't be loaded, a heuristic
 * guess is used and, when the registry doesn't know it, the name one label longer is tried once.
 */
export async function lookupDomainAge(hostname: string): Promise<DomainAge> {
  const tld = hostname.split(".").at(-1)!;
  try {
    const list = await suffixes.get();
    let candidates: string[];
    if (list) {
      if (!list.rules.has(tld) && !list.wildcards.has(tld)) throw unknownTld(tld);
      const domain = registeredDomain(list, hostname);
      if (!domain) {
        throw new ToolError("IS_SUFFIX", 400, `${hostname} is a domain ending that others register names under. Try a full name such as example.${hostname}.`);
      }
      candidates = [domain];
    } else {
      const guess = registrableDomain(hostname);
      const labels = hostname.split(".");
      const guessLabels = guess.split(".").length;
      candidates = [guess, ...(labels.length > guessLabels ? [labels.slice(-(guessLabels + 1)).join(".")] : [])];
    }
    for (const domain of candidates) {
      const found = await lookupOne(domain);
      if (found) return found;
    }
    throw notRegistered(candidates[0]!);
  } catch (e) {
    if (e instanceof ToolError) {
      if (e.code === "REGISTRY_FAILED" || e.code === "REGISTRY_BUSY") logger.warn("domain age lookup failed", { tld, code: e.code });
      throw e;
    }
    logger.warn("domain age lookup failed", { tld, error: (e as Error)?.name });
    throw registryFailed();
  }
}

/** Tests: forget cached lists, results and cool-downs. */
export function resetDomainAgeCaches() {
  bootstrap.reset();
  suffixes.reset();
  whoisServers.clear();
  results.clear();
  inflight.clear();
  cooldowns.clear();
}
