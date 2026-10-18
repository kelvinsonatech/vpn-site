import { apiError } from "@/server/public/http";
import { lookupDomainAge } from "@/server/tools/domain-age";
import { parseHostname } from "@/server/tools/hostname";
import { limitTool, readToolField, toolResponse } from "@/server/tools/http";

/**
 * POST /api/public/tools/domain-age — { domain } → DomainAge (registration and expiry dates,
 * registrar, name servers) from the domain's registry. Same-origin JSON only; shares the tools' rate
 * limit (src/server/tools/http.ts). Nothing about the visitor is sent to the registry.
 */
export async function POST(req: Request) {
  const read = await readToolField(req, "domain", "Enter a domain name such as example.com.");
  if (!read.ok) return read.response;
  const parsed = parseHostname(read.value);
  if (!parsed.ok) {
    if (parsed.reason === "ip") return apiError(400, "IS_IP", `${parsed.ip} is an IP address. Domain age needs a domain name such as example.com.`);
    return apiError(400, "INVALID_DOMAIN", "That doesn't look like a domain name. Try something like example.com.");
  }
  return (await limitTool(req)) ?? toolResponse(() => lookupDomainAge(parsed.hostname), "domain age lookup");
}
