import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { protocols, serverProtocols, servers, vpnAccounts } from "@/server/db/schema";
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
 * - Missing = the server answers `ACCOUNT_NOT_FOUND` or reports the account `revoked`. A bare 404,
 *   a timeout or any other error changes nothing.
 * - The first miss only records `missing_since`. The account is removed (status `removed`, slot
 *   released, event logged) when its next regular lookup, one interval later, misses again and the
 *   safety checks below pass. Found again → the miss is forgotten.
 * - Accounts are looked up oldest check first, so before an account's second lookup every older
 *   account of its server has been looked up since its first miss. The share of misses among those
 *   lookups tells a limiter (a few accounts) from a broken lookup (most of them).
 *
 * Safety checks, per server and protocol (a lookup can break for one protocol only):
 * - Trust: misses count only once the server has found at least one account of that protocol
 *   (`server_protocols.account_lookup_ok_at`, cleared when the server's connection changes).
 * - Share: when at least 3 accounts and at least half of those looked up since the first miss are
 *   missing, nothing is removed.
 * - Rate: at most max(10, 20 % of its active accounts) removals per server per hour.
 * Held accounts stay active with `missing_since` set (Admin → Accounts shows "Missing on server") and
 * Admin → Logs gets a warning naming them, at most once an hour per server and reason.
 *
 * Load: one short request per account per interval, at most one request in flight per server, at
 * most 40 lookups per server and 200 in total per run (a bigger server takes longer to go round),
 * servers marked offline are skipped, the first connection failure stops a server's lookups for the
 * run, and a server that answers none of its lookups (no such route, wrong answers) is paused for an
 * hour with a warning. Accounts are claimed by moving `checked_at` forward (FOR UPDATE SKIP LOCKED),
 * so several workers never check the same account twice. Nothing secret is sent or logged.
 */

/** Lookups per run (one run a minute) across all servers… */
const CLAIM_LIMIT = 200;
/** …and per server, so a big server is spread over several runs instead of getting a burst. */
const PER_SERVER_LIMIT = 40;
/** One run stops starting new lookups after this long so it never holds a maintenance slot for minutes. */
const TIME_BUDGET_MS = 40_000;
/** Servers checked in parallel; the accounts of one server are looked up one at a time. */
const SERVER_CONCURRENCY = 6;
/** Removals of a protocol are held back when at least this many of its recent lookups missed… */
const SUSPECT_MIN = 3;
/** …and they are at least this share of them. */
const SUSPECT_SHARE = 0.5;
/** Removals per server per hour: at least this many… */
const RATE_MIN = 10;
/** …or this share of its active accounts. */
const RATE_SHARE = 0.2;
const WARN_EVERY_SECONDS = 3600;
const PAUSE_SECONDS = 3600;
/** Sorted set: server id → until when (ms) the check skips it. */
const PAUSED_KEY = "account-check:paused";

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
  protocolId: string;
  remoteAccountId: string | null;
  username: string | null;
  missingSince: Date | null;
};

type Ctx = { now: Date; started: number; budget: number; result: AccountCheckResult };

const lastCheck = sql`coalesce(${vpnAccounts.checkedAt}, ${vpnAccounts.activatedAt}, ${vpnAccounts.createdAt})`;

export async function checkAccounts(opts: { now?: Date; limit?: number; timeBudgetMs?: number } = {}): Promise<AccountCheckResult> {
  const result: AccountCheckResult = { checked: 0, missing: 0, removed: 0, held: 0, failed: 0 };
  const minutes = (await getSiteSettings()).health.accountCheckMinutes;
  if (!minutes) return result;
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  const dueBefore = new Date(now.getTime() - minutes * 60_000).toISOString();
  const paused = await pausedServers(now);

  // Oldest check first (an account never checked counts from its activation, so new accounts are not
  // looked up straight away), at most PER_SERVER_LIMIT per server. FOR UPDATE cannot be combined with
  // a window function, so the chosen ids are locked in a second step that re-checks they are due.
  const claimed: Claimed[] = await db().transaction(async (tx) => {
    const candidates = await tx.execute<{ id: string }>(sql`
      select id from (
        select a.id, coalesce(a.checked_at, a.activated_at, a.created_at) as last_check,
               row_number() over (partition by a.server_id order by coalesce(a.checked_at, a.activated_at, a.created_at), a.id) as rn
        from ${vpnAccounts} a
        join ${servers} s on s.id = a.server_id
        where a.status = 'active'
          and a.remote_account_id is not null
          and a.expires_at > ${nowIso}::timestamptz
          and s.deleted_at is null
          and s.health_status <> 'offline'
          and coalesce(a.checked_at, a.activated_at, a.created_at) <= ${dueBefore}::timestamptz
          ${
            paused.length
              ? sql`and a.server_id not in (${sql.join(
                  paused.map((id) => sql`${id}::uuid`),
                  sql`, `,
                )})`
              : sql``
          }
      ) due
      where rn <= ${PER_SERVER_LIMIT}
      order by last_check, id
      limit ${opts.limit ?? CLAIM_LIMIT}`);
    const ids = [...candidates].map((r) => r.id);
    if (!ids.length) return [];
    const rows = await tx
      .select({
        id: vpnAccounts.id,
        serverId: vpnAccounts.serverId,
        protocolId: vpnAccounts.protocolId,
        remoteAccountId: vpnAccounts.remoteAccountId,
        username: vpnAccounts.username,
        missingSince: vpnAccounts.missingSince,
      })
      .from(vpnAccounts)
      .where(and(inArray(vpnAccounts.id, ids), eq(vpnAccounts.status, "active"), sql`${lastCheck} <= ${dueBefore}::timestamptz`))
      .orderBy(lastCheck, vpnAccounts.id)
      .for("update", { skipLocked: true });
    if (rows.length)
      await tx
        .update(vpnAccounts)
        .set({ checkedAt: now })
        .where(
          inArray(
            vpnAccounts.id,
            rows.map((r) => r.id),
          ),
        );
    return rows;
  });
  if (!claimed.length) return result;

  const byServer = new Map<string, Claimed[]>();
  for (const a of claimed) byServer.set(a.serverId, [...(byServer.get(a.serverId) ?? []), a]);

  const ctx: Ctx = { now, started: Date.now(), budget: opts.timeBudgetMs ?? TIME_BUDGET_MS, result };
  const queue = [...byServer.entries()];
  const work = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [serverId, accounts] = next;
      try {
        await checkServer(serverId, accounts, ctx);
      } catch (e) {
        result.failed += accounts.length;
        logger.warn("account check failed", { serverId, ...errorSummary(e) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SERVER_CONCURRENCY, queue.length) }, work));
  return result;
}

async function checkServer(serverId: string, accounts: Claimed[], ctx: Ctx): Promise<void> {
  const { driver, server } = await getNodeDriver(serverId);
  const present: Claimed[] = [];
  const missing: Claimed[] = [];
  let firstError: { code: string; message: string } | null = null;
  for (const a of accounts) {
    if (Date.now() - ctx.started > ctx.budget) break; // the rest is looked up again after the interval
    try {
      const remote = await driver.getAccount(a.remoteAccountId ?? "");
      (remote && remote.status !== "revoked" ? present : missing).push(a);
      ctx.result.checked++;
    } catch (e) {
      ctx.result.failed++;
      if (isNodeError(e) && (e.kind === "connect" || e.kind === "timeout")) break; // the health monitor deals with that
      firstError ??= isNodeError(e) ? { code: e.code, message: e.safeMessage } : { code: "UNEXPECTED", message: "Unexpected error." };
    }
  }

  // A server that answers none of its lookups (an agent without the route, answers outside the
  // contract) is skipped for an hour instead of being asked about every account again.
  if (firstError && !present.length && !missing.length) {
    await pauseServer(serverId, ctx.now);
    await warn(
      serverId,
      "lookup_failing",
      `${server.name} answered none of its account lookups (${firstError.message}). The account check skips this server for an hour, so accounts it deletes itself are not noticed. Update its node agent so GET /accounts/{id} answers as described in docs/10 and run node-selftest.py or npm run node:check.`,
      { code: firstError.code },
    );
    return;
  }

  if (present.length) {
    const ok = [...new Set(present.map((a) => a.protocolId))];
    await db()
      .update(serverProtocols)
      .set({ accountLookupOkAt: ctx.now })
      .where(and(eq(serverProtocols.serverId, serverId), inArray(serverProtocols.protocolId, ok)));
    const found = present.filter((a) => a.missingSince).map((a) => a.id);
    if (found.length) await db().update(vpnAccounts).set({ missingSince: null }).where(inArray(vpnAccounts.id, found));
  }
  if (!missing.length) return;
  ctx.result.missing += missing.length;

  const firstMiss = missing.filter((a) => !a.missingSince).map((a) => a.id);
  if (firstMiss.length) {
    await db()
      .update(vpnAccounts)
      .set({ missingSince: ctx.now })
      .where(and(inArray(vpnAccounts.id, firstMiss), eq(vpnAccounts.status, "active")));
  }
  // Missed on an earlier lookup too (at least one interval ago, since accounts are only due then).
  const confirmed = missing.filter((a) => a.missingSince);
  if (!confirmed.length) return;

  const byProtocol = new Map<string, Claimed[]>();
  for (const a of confirmed) byProtocol.set(a.protocolId, [...(byProtocol.get(a.protocolId) ?? []), a]);
  const removable: Claimed[] = [];
  for (const [protocolId, group] of byProtocol) {
    const [sp] = await db()
      .select({ okAt: serverProtocols.accountLookupOkAt, name: protocols.name })
      .from(serverProtocols)
      .innerJoin(protocols, eq(protocols.id, serverProtocols.protocolId))
      .where(and(eq(serverProtocols.serverId, serverId), eq(serverProtocols.protocolId, protocolId)))
      .limit(1);
    const protocolName = sp?.name ?? "VPN";
    if (!sp?.okAt) {
      hold(ctx, group);
      await warn(
        serverId,
        `unconfirmed:${protocolId}`,
        `${server.name} says ${names(group)} ${group.length === 1 ? "does" : "do"} not exist, but it has never found a ${protocolName} account there, so its answer is not trusted yet and nothing was removed. Check GET /accounts/{id} on the server (node-selftest.py or npm run node:check). If the server really deleted ${group.length === 1 ? "it" : "them"}, revoke ${group.length === 1 ? "it" : "them"} in Admin → Accounts.`,
        { reason: "lookup_unconfirmed", protocolId, accounts: group.map((a) => a.id) },
      );
      continue;
    }
    // Every account of this protocol checked longer ago than the newest first miss has been looked up
    // since then (oldest first), so this is the share of misses in a full round of lookups.
    const since = new Date(Math.max(...group.map((a) => a.missingSince!.getTime())));
    const [c] = await db()
      .select({
        looked: sql<number>`count(*)::int`,
        missing: sql<number>`(count(*) filter (where ${vpnAccounts.missingSince} is not null))::int`,
      })
      .from(vpnAccounts)
      .where(
        and(
          eq(vpnAccounts.serverId, serverId),
          eq(vpnAccounts.protocolId, protocolId),
          eq(vpnAccounts.status, "active"),
          isNotNull(vpnAccounts.remoteAccountId),
          gte(vpnAccounts.checkedAt, since),
        ),
      );
    if (c && c.missing >= SUSPECT_MIN && c.missing >= c.looked * SUSPECT_SHARE) {
      hold(ctx, group);
      await warn(
        serverId,
        `too_many:${protocolId}`,
        `${server.name} says ${c.missing} of the ${c.looked} ${protocolName} accounts it was asked about recently do not exist (${names(group)}…). That looks like a broken lookup rather than a login limiter, so nothing was removed. Check GET /accounts/{id} on the server; accounts it really deleted show as "Missing on server" in Admin → Accounts and can be revoked there.`,
        { reason: "too_many_missing", protocolId, missing: c.missing, looked: c.looked },
      );
      continue;
    }
    removable.push(...group);
  }
  if (!removable.length) return;

  const hourAgo = new Date(ctx.now.getTime() - 3_600_000).toISOString();
  const [r] = await db()
    .select({
      active: sql<number>`(count(*) filter (where ${vpnAccounts.status} = 'active'))::int`,
      recent: sql<number>`(count(*) filter (where ${vpnAccounts.status} = 'removed' and ${vpnAccounts.revokedAt} >= ${hourAgo}::timestamptz))::int`,
    })
    .from(vpnAccounts)
    .where(eq(vpnAccounts.serverId, serverId));
  const cap = Math.max(RATE_MIN, Math.ceil((r?.active ?? 0) * RATE_SHARE));
  const allowed = Math.max(0, cap - (r?.recent ?? 0));
  for (const a of removable.slice(0, allowed)) if (await markRemoved(a, server.name, ctx.now)) ctx.result.removed++;
  const later = removable.slice(allowed);
  if (later.length) {
    hold(ctx, later);
    await warn(
      serverId,
      "rate",
      `${server.name} already had ${r?.recent ?? 0} accounts removed in the last hour (at most ${cap} per hour, in case its lookup is wrong). ${names(later)} will be removed at a later check if the server still says ${later.length === 1 ? "it does" : "they do"} not exist.`,
      { reason: "rate", cap, accounts: later.map((a) => a.id) },
    );
  }
}

function hold(ctx: Ctx, accounts: Claimed[]) {
  ctx.result.held += accounts.length;
}

function names(accounts: Claimed[]): string {
  const shown = accounts.slice(0, 5).map((a) => a.username ?? a.remoteAccountId ?? a.id);
  return accounts.length > 5 ? `${shown.join(", ")} and ${accounts.length - 5} more` : shown.join(", ");
}

/** Mark one account removed by its server and release its slot. False when it is no longer active. */
async function markRemoved(account: Claimed, serverName: string, now: Date): Promise<boolean> {
  const row = await db().transaction(async (tx) => {
    const [acc] = await tx
      .update(vpnAccounts)
      .set({ status: "removed", revokedAt: now, missingSince: null })
      .where(and(eq(vpnAccounts.id, account.id), eq(vpnAccounts.status, "active"), isNotNull(vpnAccounts.missingSince)))
      .returning({ id: vpnAccounts.id });
    if (acc) await releaseCapacity(tx, acc.id);
    return acc;
  });
  if (!row) return false;
  const [p] = await db().select({ name: protocols.name }).from(protocols).where(eq(protocols.id, account.protocolId)).limit(1);
  await logEvent({
    event: "account.removed",
    status: "info",
    level: "warning",
    serverId: account.serverId,
    protocolId: account.protocolId,
    accountId: account.id,
    message: `${p?.name ?? "VPN"} account${account.username ? ` ${account.username}` : ""} was removed by ${serverName} before it expired (for example by its multi-login limiter). Its slot is free again.`,
  });
  return true;
}

/** Log a warning about a server at most once an hour per reason. */
async function warn(serverId: string, reason: string, message: string, details: Record<string, unknown>): Promise<void> {
  try {
    const first = await redis().set(`account-check:warn:${serverId}:${reason}`, "1", "EX", WARN_EVERY_SECONDS, "NX");
    if (first !== "OK") return;
  } catch {
    // Without Redis the warning may repeat; better than staying silent.
  }
  await logEvent({ event: "account.removed", status: "failure", level: "warning", serverId, message, details });
}

async function pauseServer(serverId: string, now: Date): Promise<void> {
  try {
    await redis().zadd(PAUSED_KEY, now.getTime() + PAUSE_SECONDS * 1000, serverId);
  } catch {
    // Without Redis the server is simply asked again next interval.
  }
}

async function pausedServers(now: Date): Promise<string[]> {
  try {
    await redis().zremrangebyscore(PAUSED_KEY, "-inf", now.getTime());
    return (await redis().zrange(PAUSED_KEY, 0, -1)).filter((id) => /^[0-9a-f-]{36}$/.test(id));
  } catch {
    return [];
  }
}
