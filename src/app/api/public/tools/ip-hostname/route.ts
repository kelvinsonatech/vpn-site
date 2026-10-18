import { apiError } from "@/server/public/http";
import { limitTool, readToolField, toolResponse } from "@/server/tools/http";
import { parseIpInput, reverseLookup } from "@/server/tools/reverse";

/**
 * POST /api/public/tools/ip-hostname — { ip } → ReverseLookup (the address's reverse DNS names, possibly
 * none, and the network that owns it).
 * Same-origin JSON only; public addresses only; shares the tools' rate limit (src/server/tools/http.ts).
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
  return (await limitTool(req)) ?? toolResponse(() => reverseLookup(parsed.ip), "reverse lookup");
}
