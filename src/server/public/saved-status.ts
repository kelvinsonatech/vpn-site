import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { provisioningRequests, vpnAccounts } from "@/server/db/schema";
import type { SavedAccountServerStatus } from "@/lib/public/types";

export const MAX_SAVED_STATUS_IDS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Status of the accounts saved in a visitor's My accounts list, keyed by the creation request id
 * the list stores. Reads the database only (never the servers), and returns nothing but the status:
 * no username, server or credentials. Unknown ids, accounts that were never created and malformed
 * ids are left out.
 */
export async function getSavedAccountStatuses(requestIds: readonly string[]): Promise<Record<string, SavedAccountServerStatus>> {
  const ids = [...new Set(requestIds.filter((id) => UUID.test(id)))].slice(0, MAX_SAVED_STATUS_IDS);
  if (!ids.length) return {};
  const rows = await db()
    .select({ requestId: provisioningRequests.id, status: vpnAccounts.status, revokedAt: vpnAccounts.revokedAt })
    .from(provisioningRequests)
    .innerJoin(vpnAccounts, eq(vpnAccounts.id, provisioningRequests.accountId))
    .where(and(inArray(provisioningRequests.id, ids), eq(provisioningRequests.operation, "create")));
  const out: Record<string, SavedAccountServerStatus> = {};
  for (const r of rows) {
    if (r.status === "active" || r.status === "expired") out[r.requestId] = { status: r.status };
    else if (r.status === "removed" || r.status === "revoked") out[r.requestId] = { status: "removed", removedAt: r.revokedAt?.toISOString() ?? null };
  }
  return out;
}
