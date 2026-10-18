import { after } from "next/server";
import { logger } from "@/server/logging/logger";
import { apiError } from "@/server/public/http";
import { limitTool, readToolField, toolResponse } from "@/server/tools/http";
import { MAX_WEBSITE_CHECKS, parseIpInput, reverseLookup } from "@/server/tools/reverse";
import { deleteSightings, quietDbError, sightingsFor } from "@/server/tools/sightings";

/**
 * POST /api/public/tools/ip-hostname — { ip } → ReverseLookup: the websites seen on the address (re-checked
 * now), its reverse DNS names (possibly none) and the network that owns it. Same-origin JSON only;
 * public addresses only; shares the tools' rate limit (src/server/tools/http.ts). Remembered names that
 * DNS says have moved away are forgotten after the response.
 */
export async function POST(req: Request) {
  const read = await readToolField(req, "ip", "Enter an IP address such as 8.8.8.8.");
  if (!read.ok) return read.response;
  const parsed = parseIpInput(read.value);
  if (!parsed.ok) {
    if (parsed.reason === "hostname") return apiError(400, "IS_HOSTNAME", "That's a hostname, not an IP address. Use Hostname to IP to find its address.");
    if (parsed.reason === "private") return apiError(400, "PRIVATE_IP", `${parsed.ip} is a private or reserved address, so it has no public hostname.`);
    return apiError(400, "INVALID_IP", "That doesn't look like an IP address. Try something like 8.8.8.8.");
  }
  const { ip } = parsed;
  return (
    (await limitTool(req)) ??
    toolResponse(async () => {
      const candidates = await sightingsFor(ip, MAX_WEBSITE_CHECKS).catch((e: unknown) => {
        logger.warn("dns sightings unavailable", quietDbError(e));
        return [];
      });
      const { lookup, stale } = await reverseLookup(ip, candidates);
      if (stale.length) after(() => deleteSightings(ip, stale).catch((e: unknown) => logger.warn("dns sightings not pruned", quietDbError(e))));
      return lookup;
    }, "reverse lookup")
  );
}
