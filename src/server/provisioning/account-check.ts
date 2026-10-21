import { and, asc, eq, gt, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { protocols, servers, vpnAccounts } from "@/server/db/schema";
import { logEvent } from "@/server/logging/events";
import { errorSummary, logger } from "@/server/logging/logger";
import { getNodeDriver } from "@/server/nodes/connection";
import { isNodeError } from "@/server/nodes/errors";
import { redis } from "@/server/redis";
import { getSiteSettings } from "@/server/settings/service";
import { releaseCapacity } from "./capacity";

/**
 * Account check. Runs every minute in the worker.
 *
 * A server can delete an account on its own before it expires, for example when its multi-login
 * limiter catches the account on too many devices. The website only learns about it by asking:
 * every active account is looked up with the predefined `GET /accounts/{id}` once per
 * **Settings → Health monitor → Account check** interval (0 turns the check off).
 *
 * - The account is missing when the server answers `ACCOUNT_NOT_FOUND` or reports it `revoked`.
 *   A bare 404, a timeout or any other error changes nothing.
 * - The first miss only records `missing_since`; the account is checked again about a minute later
 *   and becomes `removed` (slot released, event logged) only if it is still missing. Found again →
 *   the miss is forgotten.
 * - Safety valves against a broken lookup that says "not found" for accounts that do exist: a
 *   server's misses are trusted only once it has found at least one account
 *   (`servers.account_lookup_ok_at`), and when at least 5 accounts and at least half of a server's
 *   active accounts are missing at once, that looks like a broken lookup rather than a limiter. In
 *   both cases nothing on that server is removed and Admin → Logs gets a warning (at most once an
 *   hour per server).
 *
 * Load stays small: one short request per account per interval, at most one request in flight per
 * server, at most 40 lookups per server and 200 in total per minute (a bigger fleet just takes more
 * than one interval to go round). Accounts are claimed by moving `checked_at` forward (FOR UPDATE
 * SKIP LOCKED), so several workers never check the same account twice. Servers marked offline are
 * skipped; the first connection failure stops the checks on that server for this run. Nothing
 * secret is sent or logged.
 */

/** Lookups per run (one run a minute) across all servers… */
const CLAIM_LIMIT = 200;
/** …and per server, so a big server is spread over several runs instead of getting a burst. */
const PER_SERVER_LIMIT = 40;
/** Due accounts read per run before the per-server cap is applied. */
const SCAN_LIMIT = 1000;
/** One run stops starting new lookups after this long so it never holds a maintenance slot for minutes. */
const TIME_BUDGET_MS = 40_000;
/** Servers checked in parallel; the accounts of one server are looked up one at a time. */
const SERVER_CONCURRENCY = 6;
/** A missing account is looked up again after this long and removed if it is still missing. */
const CONFIRM_AFTER_MS = 50_000;
/** Removals on a server are held back when at least this many of its accounts are missing… */
const SUSPECT_MIN = 5;
/** …and they are at least this share of its active accounts. */
const SUSPECT_SHARE = 0.5;
const WARN_EVERY_SECONDS = 3600;

export interface AccountCheckResult {
  checked: number;
  missing: number;
  removed: number;
  held: number;
  failed: number;
}

type Claimed = {
  id: string;
  serverId: string;
  remoteAccountId: string | null;
  missingSince: Date | null;
};

export async function checkAccounts(opts: { now?: Date; limit?: number; timeBudgetMs?: number } = {}): Promise<AccountCheckResult> {
  const result: AccountCheckResult = { checked: 0, missing: 0, removed: 0, held: 0, failed: 0 };
  const minutes = (await getSiteSettings()).health.accountCheckMinutes;
  if (!minutes) return result;
  const now = opts.now ?? new Date();
  const dueBefore = new Date(now.getTime() - minutes * 60_000).toISOString();
  const confirmBefore = new Date(now.getTime() - CONFIRM_AFTER_MS).toISOString();

  // Accounts that were never checked count from their activation, so a new account is not looked up
  // straight away. Accounts waiting for their second lookup go first.
  const lastCheck = sql`coalesce(${vpnAccounts.checkedAt}, ${vpnAccounts.activatedAt}, ${vpnAccounts.createdAt})`;
  // Only the lookup right after a first miss is brought forward (checked_at still equals
  // missing_since). Misses that were held back wait for the normal interval like everything else, so
  // they can neither hog a server's lookups nor hammer it every minute.
  const awaitingSecond = sql`(${vpnAccounts.missingSince} is not null and ${vpnAccounts.checkedAt} = ${vpnAccounts.missingSince})`;
  const claimed: Claimed[] = await db().transaction(async (tx) => {
    const rows = await tx
      .select({ id: vpnAccounts.id, serverId: vpnAccounts.serverId, remoteAccountId: vpnAccounts.remoteAccountId, missingSince: vpnAccounts.missingSince })
      .from(vpnAccounts)
      .innerJoin(servers, eq(servers.id, vpnAccounts.serverId))
      .where(
        and(
          eq(vpnAccounts.status, "active"),
          isNotNull(vpnAccounts.remoteAccountId),
          gt(vpnAccounts.expiresAt, now),
          isNull(servers.deletedAt),
          ne(servers.healthStatus, "offline"),
          sql`(${lastCheck} <= ${dueBefore}::timestamptz or (${awaitingSecond} and ${lastCheck} <= ${confirmBefore}::timestamptz))`,
        ),
      )
      .orderBy(sql`${awaitingSecond} desc`, asc(lastCheck))
      .limit(SCAN_LIMIT)
      .for("update", { of: vpnAccounts, skipLocked: true });
    const perServer = new Map<string, number>();
    const picked = rows
      .filter((r) => {
        const n = (perServer.get(r.serverId) ?? 0) + 1;
        perServer.set(r.serverId, n);
        return n <= PER_SERVER_LIMIT;
      })
      .slice(0, opts.limit ?? CLAIM_LIMIT);
    if (picked.length)
      await tx
        .update(vpnAccounts)
        .set({ checkedAt: now })
        .where(
          inArray(
            vpnAccounts.id,
            picked.map((r) => r.id),
          ),
        );
    return picked;
  });
  if (!claimed.length) return result;

  const byServer = new Map<string, Claimed[]>();
  for (const a of claimed) byServer.set(a.serverId, [...(byServer.get(a.serverId) ?? []), a]);

  const started = Date.now();
  const budget = opts.timeBudgetMs ?? TIME_BUDGET_MS;
  const queue = [...byServer.entries()];
  const work = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [serverId, accounts] = next;
      try {
        await checkServer(serverId, accounts, { now, started, budget, result });
      } catch (e) {
        result.failed += accounts.length;
        logger.warn("account check failed", { serverId, ...errorSummary(e) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SERVER_CONCURRENCY, queue.length) }, work));
  return result;
}

async function checkServer(
  serverId: string,
  accounts: Claimed[],
  ctx: { now: Date; started: number; budget: number; result: AccountCheckResult },
): Promise<void> {
  const { driver } = await getNodeDriver(serverId);
  const present: Claimed[] = [];
  const missing: Claimed[] = [];
  for (const a of accounts) {
    if (Date.now() - ctx.started > ctx.budget) break; // the rest is looked up again after the interval
    try {
      const remote = await driver.getAccount(a.remoteAccountId ?? "");
      (remote && remote.status !== "revoked" ? present : missing).push(a);
      ctx.result.checked++;
    } catch (e) {
      ctx.result.failed++;
      if (isNodeError(e) && (e.kind === "connect" || e.kind === "timeout")) break;
    }
  }

  if (present.length) await db().update(servers).set({ accountLookupOkAt: ctx.now }).where(eq(servers.id, serverId));
  const found = present.filter((a) => a.missingSince).map((a) => a.id);
  if (found.length) await db().update(vpnAccounts).set({ missingSince: null }).where(inArray(vpnAccounts.id, found));
  if (!missing.length) return;
  ctx.result.missing += missing.length;

  const firstMiss = missing.filter((a) => !a.missingSince).map((a) => a.id);
  if (firstMiss.length) {
    await db()
      .update(vpnAccounts)
      .set({ missingSince: ctx.now })
      .where(and(inArray(vpnAccounts.id, firstMiss), eq(vpnAccounts.status, "active")));
  }
  const confirmed = missing.filter((a) => a.missingSince && ctx.now.getTime() - a.missingSince.getTime() >= CONFIRM_AFTER_MS);
  if (!confirmed.length) return;

  const [server] = await db().select({ name: servers.name, lookupOkAt: servers.accountLookupOkAt }).from(servers).where(eq(servers.id, serverId)).limit(1);
  const [counts] = await db()
    .select({
      active: sql<number>`count(*)::int`,
      missing: sql<number>`(count(*) filter (where ${vpnAccounts.missingSince} is not null))::int`,
    })
    .from(vpnAccounts)
    .where(and(eq(vpnAccounts.serverId, serverId), eq(vpnAccounts.status, "active"), isNotNull(vpnAccounts.remoteAccountId)));
  const name = server?.name ?? "A server";
  if (!server?.lookupOkAt) {
    ctx.result.held += confirmed.length;
    await warnHeld(
      serverId,
      `${name} says ${confirmed.length === 1 ? "an account does" : `${confirmed.length} accounts do`} not exist, but it has not yet confirmed that any account exists, so its GET /accounts/{id} answer is not trusted and no account was marked removed. Check that lookup on the server (npm run node:check or node-selftest.py); accounts it really deleted can be revoked in Admin → Accounts.`,
      { missing: confirmed.length, reason: "lookup_unconfirmed" },
    );
    return;
  }
  if (counts && counts.missing >= SUSPECT_MIN && counts.missing >= counts.active * SUSPECT_SHARE) {
    ctx.result.held += confirmed.length;
    await warnHeld(
      serverId,
      `${name} says ${counts.missing} of its ${counts.active} active accounts do not exist. That looks like a problem with its GET /accounts/{id} answer rather than a login limiter, so no account was marked removed. Check the server; accounts it really deleted can be revoked in Admin → Accounts.`,
      { missing: counts.missing, active: counts.active, reason: "too_many_missing" },
    );
    return;
  }

  for (const a of confirmed) if (await markRemoved(a.id, ctx.now)) ctx.result.removed++;
}

/** Mark one account removed by its server and release its slot. False when it is no longer active. */
async function markRemoved(accountId: string, now: Date): Promise<boolean> {
  const row = await db().transaction(async (tx) => {
    const [acc] = await tx
      .update(vpnAccounts)
      .set({ status: "removed", revokedAt: now, missingSince: null })
      .where(and(eq(vpnAccounts.id, accountId), eq(vpnAccounts.status, "active"), isNotNull(vpnAccounts.missingSince)))
      .returning({ id: vpnAccounts.id, serverId: vpnAccounts.serverId, protocolId: vpnAccounts.protocolId, username: vpnAccounts.username });
    if (acc) await releaseCapacity(tx, acc.id);
    return acc;
  });
  if (!row) return false;
  const [names] = await db()
    .select({ server: servers.name, protocol: protocols.name })
    .from(servers)
    .innerJoin(protocols, eq(protocols.id, row.protocolId))
    .where(eq(servers.id, row.serverId))
    .limit(1);
  await logEvent({
    event: "account.removed",
    status: "info",
    level: "warning",
    serverId: row.serverId,
    protocolId: row.protocolId,
    accountId: row.id,
    message: `${names?.protocol ?? "VPN"} account${row.username ? ` ${row.username}` : ""} was removed by ${names?.server ?? "its server"} before it expired (for example by its multi-login limiter). Its slot is free again.`,
  });
  return true;
}

/** Log why removals on a server were held back, at most once an hour per server. */
async function warnHeld(serverId: string, message: string, details: Record<string, unknown>): Promise<void> {
  try {
    const first = await redis().set(`account-check:held:${serverId}`, "1", "EX", WARN_EVERY_SECONDS, "NX");
    if (first !== "OK") return;
  } catch {
    // Without Redis the warning may repeat; better than staying silent.
  }
  await logEvent({ event: "account.removed", status: "failure", level: "warning", serverId, message, details });
}
