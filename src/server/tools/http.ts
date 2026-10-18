import { rateLimit } from "@/server/auth/rate-limit";
import { clientIpFromHeaders } from "@/server/auth/request-context";
import { hashClientIp } from "@/server/crypto/hashing";
import { errorSummary, logger } from "@/server/logging/logger";
import { apiError, noStoreJson, rateLimited, readPublicJson } from "@/server/public/http";
import { ToolError } from "./errors";

/**
 * Request handling shared by the tools API (src/app/api/public/tools): same-origin JSON carrying one
 * short text field, one rate limit for all tools together, and ToolErrors turned into responses.
 * Inputs and results are never logged.
 */

const MAX_BODY_BYTES = 1024;
const MAX_INPUT = 300;
/** 30 lookups per 5 minutes per client network, across every tool (keyed by the IP's hash, never the IP). */
const LIMIT = 30;
const WINDOW_SECONDS = 300;

export async function readToolField(req: Request, field: string, invalidMessage: string): Promise<{ ok: true; value: string } | { ok: false; response: Response }> {
  const read = await readPublicJson(req, MAX_BODY_BYTES);
  if (!read.ok) return read;
  const value = read.body && typeof read.body === "object" ? (read.body as Record<string, unknown>)[field] : undefined;
  if (typeof value !== "string" || value.length > MAX_INPUT) return { ok: false, response: apiError(400, "INVALID_INPUT", invalidMessage) };
  return { ok: true, value };
}

/** Counts this lookup; returns the 429 response once the client is over the limit. */
export async function limitTool(req: Request): Promise<Response | null> {
  const limit = await rateLimit(`tools:${hashClientIp(clientIpFromHeaders(req.headers)) ?? "unknown"}`, LIMIT, WINDOW_SECONDS, "open");
  return limit.allowed ? null : rateLimited("Too many lookups. Please wait a few minutes and try again.", limit.resetSeconds);
}

export async function toolResponse(lookup: () => Promise<unknown>, what: string): Promise<Response> {
  try {
    return noStoreJson(await lookup());
  } catch (e) {
    if (e instanceof ToolError) return apiError(e.httpStatus, e.code, e.message);
    logger.error(`${what} failed`, errorSummary(e));
    return apiError(500, "INTERNAL", "Something went wrong on our side. Please try again in a moment.");
  }
}
