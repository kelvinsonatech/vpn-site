import { apiError } from "@/server/public/http";
import { lookupHostname, parseHostname } from "@/server/tools/hostname";
import { limitTool, readToolField, toolResponse } from "@/server/tools/http";

/**
 * POST /api/public/tools/hostname-ip — { hostname } → HostnameLookup (its IPv4 and IPv6 addresses).
 * Same-origin JSON only; shares the tools' rate limit (src/server/tools/http.ts).
 */
export async function POST(req: Request) {
  const read = await readToolField(req, "hostname", "Enter a hostname such as example.com.");
  if (!read.ok) return read.response;
  const parsed = parseHostname(read.value);
  if (!parsed.ok) {
    if (parsed.reason === "ip") return apiError(400, "ALREADY_IP", `${parsed.ip} is already an IP address.`);
    return apiError(400, "INVALID_HOSTNAME", "That doesn't look like a hostname. Try something like example.com.");
  }
  return (await limitTool(req)) ?? toolResponse(() => lookupHostname(parsed.hostname), "hostname lookup");
}
