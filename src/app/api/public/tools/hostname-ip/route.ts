import { after } from "next/server";
import { clientIpFromHeaders } from "@/server/auth/request-context";
import { clientNetwork } from "@/server/crypto/hashing";
import { logger } from "@/server/logging/logger";
import { apiError } from "@/server/public/http";
import { lookupHostname, parseHostname } from "@/server/tools/hostname";
import { limitTool, readToolField, toolResponse } from "@/server/tools/http";
import { canonical } from "@/server/tools/reverse";
import { quietDbError, recordSightings } from "@/server/tools/sightings";

/**
 * POST /api/public/tools/hostname-ip — { hostname } → HostnameLookup (its IPv4 and IPv6 addresses).
 * Same-origin JSON only; shares the tools' rate limit (src/server/tools/http.ts). The hostname and its
 * public addresses (never who asked) are remembered so "IP to Hostname" can list websites on an IP,
 * except addresses in the asker's own network: a name pointing at the asker is their own machine.
 */
export async function POST(req: Request) {
  const read = await readToolField(req, "hostname", "Enter a hostname such as example.com.");
  if (!read.ok) return read.response;
  const parsed = parseHostname(read.value);
  if (!parsed.ok) {
    if (parsed.reason === "ip") return apiError(400, "ALREADY_IP", `${parsed.ip} is already an IP address.`);
    return apiError(400, "INVALID_HOSTNAME", "That doesn't look like a hostname. Try something like example.com.");
  }
  return (
    (await limitTool(req)) ??
    toolResponse(async () => {
      const result = await lookupHostname(parsed.hostname);
      const asker = clientIpFromHeaders(req.headers);
      const own = asker ? clientNetwork(asker) : null;
      const ips = [...result.ipv4, ...result.ipv6]
        .filter((a) => a.public)
        .map((a) => canonical(a.address))
        .filter((ip) => clientNetwork(ip) !== own);
      after(() => recordSightings(result.hostname, ips).catch((e: unknown) => logger.warn("dns sightings not recorded", quietDbError(e))));
      return result;
    }, "hostname lookup")
  );
}
