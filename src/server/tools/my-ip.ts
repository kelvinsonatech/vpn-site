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

export interface MyIpDetails {
  hostnames: ReverseHostname[];
  /** The reverse DNS lookup got no answer, so `hostnames` is unknown rather than none. */
  reverseDnsFailed: boolean;
  network: IpNetwork | null;
  /** The public server this address belongs to, when the visitor is connected through it. */
  server: OurServer | null;
}

/** The listed (active or maintenance) server whose address is `ip`, compared in canonical form. */
export async function ourServerAt(ip: string): Promise<OurServer | null> {
  const rows = await db()
    .select({ name: servers.name, countryCode: servers.countryCode, ipAddress: servers.ipAddress })
    .from(servers)
    .where(and(isNull(servers.deletedAt), inArray(servers.lifecycle, ["active", "maintenance"])));
  const match = rows.find((s) => canonical(s.ipAddress.trim().toLowerCase()) === ip);
  return match ? { name: match.name, countryCode: match.countryCode } : null;
}

/** Details for a public address (already canonical, see parseIpInput). A failed DNS lookup or database read leaves its part empty. */
export async function myIpDetails(ip: string): Promise<MyIpDetails> {
  const [lookup, server] = await Promise.all([
    reverseLookup(ip).then(
      (r) => r.lookup,
      (e: unknown) => {
        if (e instanceof ToolError) return null;
        throw e;
      },
    ),
    ourServerAt(ip).catch((e: unknown) => {
      logger.warn("server address check unavailable", quietDbError(e));
      return null;
    }),
  ]);
  return { hostnames: lookup?.hostnames ?? [], reverseDnsFailed: lookup ? lookup.reverseDnsFailed : true, network: lookup?.network ?? null, server };
}
