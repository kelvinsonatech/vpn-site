import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { rateLimit } from "@/server/auth/rate-limit";
import { db } from "@/server/db";
import { dnsSightings } from "@/server/db/schema";
import { registrableDomain } from "./domain-name";

/**
 * The tools' memory of which hostname pointed to which IP (src/server/db/schema.ts dnsSightings):
 * written by "Hostname to IP", read by "IP to Hostname" to list the websites on an address. Names are
 * shown only after a fresh DNS check, so the memory only decides which names to check.
 *
 * Writes are bounded however many clients there are: at most MAX_IPS_PER_NAME addresses per lookup,
 * MAX_NAMES_PER_DOMAIN names per registrable domain (a wildcard zone can't flood the table) and a
 * daily global budget. Dynamic-DNS and tunnel names, which usually point at someone's own machine, are
 * never stored.
 */

export const RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;
const MAX_IPS_PER_NAME = 4;
const MAX_NAMES_PER_DOMAIN = 20;
const DAILY_BUDGET = 5_000;
/** Read side: per domain, only its most recent names are checked, so one domain can't fill an IP's list. */
const CANDIDATES_PER_DOMAIN = 2;

/** Dynamic-DNS, tunnel and preview domains: names that usually point at one person's machine. */
const PERSONAL_SUFFIXES = [
  "duckdns.org", "ddns.net", "no-ip.org", "no-ip.biz", "no-ip.info", "hopto.org", "zapto.org", "sytes.net", "servebeer.com", "serveftp.com",
  "dynv6.net", "dynu.net", "dyndns.org", "dynalias.com", "freedns.afraid.org", "mooo.com", "myfritz.net", "synology.me", "myds.me",
  "tplinkdns.com", "asuscomm.com", "ddnsfree.com", "ddnsgeek.com", "camdvr.org", "trycloudflare.com", "ngrok.io", "ngrok-free.app",
  "ngrok.app", "loca.lt", "serveo.net", "localtunnel.me", "nip.io", "sslip.io", "xip.io",
];

export function isPersonalName(hostname: string): boolean {
  return PERSONAL_SUFFIXES.some((s) => hostname === s || hostname.endsWith(`.${s}`));
}

/** Database errors without their message: drizzle puts the query parameters (IPs, hostnames) in it. */
export function quietDbError(e: unknown) {
  const err = e as { name?: string; cause?: { code?: string } };
  return { error: err?.name ?? "Error", code: err?.cause?.code };
}

/** Remember that `hostname` resolves to these public IPs, within the caps above. Returns whether it stored anything. */
export async function recordSightings(hostname: string, ips: string[]): Promise<boolean> {
  const rows = [...new Set(ips)].sort().slice(0, MAX_IPS_PER_NAME);
  if (!rows.length || isPersonalName(hostname)) return false;
  const domain = registrableDomain(hostname);
  const [{ others = 0 } = {}] = await db()
    .select({ others: sql<number>`count(distinct ${dnsSightings.hostname})::int` })
    .from(dnsSightings)
    .where(and(eq(dnsSightings.domain, domain), ne(dnsSightings.hostname, hostname)));
  if (others >= MAX_NAMES_PER_DOMAIN) return false;
  if (!(await rateLimit("tools:sightings", DAILY_BUDGET, 86_400, "closed")).allowed) return false;
  const now = new Date();
  // Sorted rows: concurrent upserts of the same name lock them in the same order (no deadlock).
  await db()
    .insert(dnsSightings)
    .values(rows.map((ip) => ({ ip, hostname, domain, firstSeen: now, lastSeen: now })))
    .onConflictDoUpdate({ target: [dnsSightings.ip, dnsSightings.hostname], set: { lastSeen: now } });
  return true;
}

/** Names to check for `ip`: per domain its most recently looked-up ones, newest first. */
export async function sightingsFor(ip: string, limit: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString();
  const rows = await db().execute<{ hostname: string }>(sql`
    select hostname from (
      select hostname, last_seen, row_number() over (partition by domain order by last_seen desc) as rank
      from ${dnsSightings}
      where ip = ${ip} and last_seen > ${cutoff}::timestamptz
    ) ranked
    where rank <= ${CANDIDATES_PER_DOMAIN}
    order by last_seen desc
    limit ${limit}`);
  return [...rows].map((r) => r.hostname);
}

/** Forget names that DNS says no longer point to `ip`. */
export async function deleteSightings(ip: string, hostnames: string[]): Promise<void> {
  if (!hostnames.length) return;
  await db()
    .delete(dnsSightings)
    .where(and(eq(dnsSightings.ip, ip), inArray(dnsSightings.hostname, hostnames)));
}

/** Hourly (worker): drop pairs nobody has looked up for the retention period. */
export async function purgeDnsSightings(days = RETENTION_DAYS): Promise<number> {
  const res = await db()
    .delete(dnsSightings)
    .where(lt(dnsSightings.lastSeen, new Date(Date.now() - days * DAY_MS)));
  return res.count ?? 0;
}
