import { z } from "zod";
import { rateLimit } from "@/server/auth/rate-limit";
import { clientIpFromHeaders } from "@/server/auth/request-context";
import { hashClientIp } from "@/server/crypto/hashing";
import { errorSummary, logger } from "@/server/logging/logger";
import { apiError, noStoreJson, rateLimited, readPublicJson } from "@/server/public/http";
import { getSavedAccountStatuses, MAX_SAVED_STATUS_IDS } from "@/server/public/saved-status";
import type { SavedAccountStatusResponse } from "@/lib/public/types";

const MAX_BODY_BYTES = 4096;
/** My accounts asks when it opens and when the tab comes back into view. */
const LOOKUPS_PER_MINUTE = 30;

const requestSchema = z.object({ ids: z.array(z.string().max(64)).max(MAX_SAVED_STATUS_IDS) }).strict();

/**
 * POST /api/public/accounts/status `{ ids }` → SavedAccountStatusResponse. Same-origin JSON only,
 * rate limited per IP. The ids are the random creation request ids My accounts keeps; the answer
 * holds only each account's status, so it needs no claim token.
 */
export async function POST(req: Request) {
  const read = await readPublicJson(req, MAX_BODY_BYTES);
  if (!read.ok) return read.response;
  const body = requestSchema.safeParse(read.body);
  if (!body.success) return apiError(400, "INVALID_REQUEST", "Invalid request. Please reload the page and try again.");

  const key = hashClientIp(clientIpFromHeaders(req.headers)) ?? "unknown";
  const limit = await rateLimit(`saved-status:${key}`, LOOKUPS_PER_MINUTE, 60, "open");
  if (!limit.allowed) return rateLimited("Too many requests. Please wait a moment.", limit.resetSeconds);

  try {
    const res: SavedAccountStatusResponse = { accounts: await getSavedAccountStatuses(body.data.ids) };
    return noStoreJson(res);
  } catch (e) {
    logger.error("saved account status lookup failed", errorSummary(e));
    return apiError(500, "INTERNAL", "Something went wrong on our side. Please try again in a moment.");
  }
}
