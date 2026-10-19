import { isIP } from "node:net";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { servers } from "@/server/db/schema";
import { logger } from "@/server/logging/logger";
import { ToolError } from "./errors";
import { canonical, reverseLookup, type IpNetwork, type ReverseHostname } from "./reverse";
import { quietDbError } from "./sightings";

/**
 * "Check My IP" tool: the visitor's own public address (taken from the request, never typed in), its
 * reverse DNS names and network (the same DNS lookups as "IP to Hostname"), and whether it is the
 * address of one of our public servers, i.e. the visitor is browsing through one of our tunnels.
 * Nothing is stored and the address is never logged.
 */

export interface OurServer {
  name: string;
  countryCode: string;
}

export interface ServerMatch {
  /** The listed server at this address: the visitor is browsing through it. */
  server: OurServer | null;
  /**
   * Each server is listed by one address. A tunnel reaching us over the other IP family (IPv6 traffic
   * from a server listed by its IPv4) can't be recognised, so "not one of ours" is only certain when
   * every listed server has an address in the visitor's family.
   */
  certain: boolean;
  /** Some listed server has an address in the visitor's family (for wording the uncertain case). */
  anyInFamily: boolean;
}

export interface AddressDetails {
  hostnames: ReverseHostname[];
  /** The reverse DNS lookup got no answer, so `hostnames` is unknown rather than none. */
  reverseDnsFailed: boolean;
  network: IpNetwork | null;
}

export interface MyIpDetails {
  /** Null when the server list couldn't be read. */
  match: ServerMatch | null;
  /** Null when the DNS lookups were skipped (rate limit). */
  dns: AddressDetails | null;
}

/** A stored server address in the form visitors' addresses are compared in: "::FFFF:45.33.32.156" → "45.33.32.156", IPv6 canonical. */
function normalize(raw: string): string {
  const s = raw.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  return canonical(mapped ? mapped[1]! : s);
}

/** Matches `ip` (canonical, see parseIpInput) against the listed (active or maintenance) servers. */
export async function matchServer(ip: string): Promise<ServerMatch> {
  const rows = await db()
    .select({ name: servers.name, countryCode: servers.countryCode, ipAddress: servers.ipAddress })
    .from(servers)
    .where(and(isNull(servers.deletedAt), inArray(servers.lifecycle, ["active", "maintenance"])));
  const listed = rows.map((s) => ({ ...s, ip: normalize(s.ipAddress) }));
  const match = listed.find((s) => s.ip === ip);
  const family = isIP(ip);
  return {
    server: match ? { name: match.name, countryCode: match.countryCode } : null,
    certain: !!match || listed.every((s) => isIP(s.ip) === family),
    anyInFamily: listed.some((s) => isIP(s.ip) === family),
  };
}

/** Reverse DNS and network for the address; a lookup that failed leaves its part empty. */
async function addressDetails(ip: string): Promise<AddressDetails> {
  try {
    const { lookup } = await reverseLookup(ip);
    return { hostnames: lookup.hostnames, reverseDnsFailed: lookup.reverseDnsFailed, network: lookup.network };
  } catch (e) {
    if (e instanceof ToolError) return { hostnames: [], reverseDnsFailed: true, network: null };
    throw e;
  }
}

/** Everything about the address: the server match always (one small query), the DNS lookups when `lookUpDns`. */
export async function myIpDetails(ip: string, lookUpDns = true): Promise<MyIpDetails> {
  const [match, dns] = await Promise.all([
    matchServer(ip).catch((e: unknown) => {
      logger.warn("server address check unavailable", quietDbError(e));
      return null;
    }),
    lookUpDns ? addressDetails(ip) : null,
  ]);
  return { match, dns };
}
