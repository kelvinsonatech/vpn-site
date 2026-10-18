import { rateLimit } from "@/server/auth/rate-limit";
import { clientIpFromHeaders } from "@/server/auth/request-context";
import { hashClientIp } from "@/server/crypto/hashing";
import { errorSummary, logger } from "@/server/logging/logger";
import { apiError, noStoreJson, rateLimited, readPublicJson } from "@/server/public/http";
import { HostnameLookupError, lookupHostname, parseHostname } from "@/server/tools/hostname";

const MAX_BODY_BYTES = 1024;
const LIMIT = 30;
const WINDOW_SECONDS = 300;

/**
 * POST /api/public/tools/hostname-ip — { hostname } → HostnameLookup (its IPv4 and IPv6 addresses).
 * Same-origin JSON only; 30 lookups per 5 minutes per client network (keyed by a hash, not the IP).
 */
export async function POST(req: Request) {
  const read = await readPublicJson(req, MAX_BODY_BYTES);
  if (!read.ok) return read.response;
  const raw = read.body && typeof read.body === "object" ? (read.body as { hostname?: unknown }).hostname : undefined;
  if (typeof raw !== "string" || raw.length > 300) return apiError(400, "INVALID_HOSTNAME", "Enter a hostname such as example.com.");
  const parsed = parseHostname(raw);
  if (!parsed.ok) {
    if (parsed.reason === "ip") return apiError(400, "ALREADY_IP", `${parsed.ip} is already an IP address.`);
    return apiError(400, "INVALID_HOSTNAME", "That doesn't look like a hostname. Try something like example.com.");
  }

  const limit = await rateLimit(`tools:${hashClientIp(clientIpFromHeaders(req.headers)) ?? "unknown"}`, LIMIT, WINDOW_SECONDS, "open");
  if (!limit.allowed) return rateLimited("Too many lookups. Please wait a few minutes and try again.", limit.resetSeconds);

  try {
    return noStoreJson(await lookupHostname(parsed.hostname));
  } catch (e) {
    if (e instanceof HostnameLookupError) return apiError(e.httpStatus, e.code, e.message);
    logger.error("hostname lookup failed", errorSummary(e));
    return apiError(500, "INTERNAL", "Something went wrong on our side. Please try again in a moment.");
  }
}
