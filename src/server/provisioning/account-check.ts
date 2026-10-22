import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { protocols, serverProtocols, servers, vpnAccounts } from "@/server/db/schema";
import { logEvent } from "@/server/logging/events";
import { errorSummary, logger } from "@/server/logging/logger";
import { getNodeDriver } from "@/server/nodes/connection";
import type { NodeAccount } from "@/server/nodes/contract";
import { isNodeError, type NodeError } from "@/server/nodes/errors";
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
 * - Missing = the server answers `ACCOUNT_NOT_FOUND` or reports the account `revoked`; found = it
 *   returns the account. Only these answers count (`answered_at`). A bare 404, a timeout or any other
 *   error is no answer.
 * - A found account the server does not let connect (`"status": "disabled"`, e.g. with
 *   `"disabled_reason": "multi_login"` when its multi-login limiter banned it, or `"expired"` before
 *   the expiry date here) is mirrored in `server_state*` for display: Admin → Accounts and My accounts
 *   show it as banned or blocked, an event is logged when it starts and ends. Nothing else changes
 *   (it stays active and keeps its slot), and it clears as soon as the server reports it active.
 * - The first miss only records `missing_since`. The account is removed (status `removed`, slot
 *   released, event logged) when its next regular lookup, one interval later, misses again and every
 *   safety check below passes. Found again → the miss is forgotten.
 *
 * Safety checks, per server and protocol (a lookup can break for one protocol only). The population
 * is the protocol's accounts that existed before the misses started and were answered since:
 * - Known good: at least one of them must have been found in a later check than the misses,
 *   otherwise a broken lookup cannot be ruled out and nothing is removed.
 * - Share: when at least 3 and at least half of them are missing, nothing is removed, and that
 *   verdict sticks (`server_protocols.account_lookup_suspect_at`): accounts that went missing before
 *   it are never removed automatically, only found again or revoked by an administrator.
 * - Unreliable: when an account reported missing is found again, removals of that protocol on that
 *   server wait 2 hours (`account_lookup_false_miss_at`).
 * - Rate: at most max(10, 20 % of its active accounts) removals per server per hour.
 * Held accounts stay active with `missing_since` set (Admin → Accounts shows "Missing on server") and
 * Admin → Logs gets a warning naming them, at most once an hour per server and reason. Changing a
 * server's connection or address clears its verdicts.
 *
 * Load: one short request per account per interval, at most one request in flight per server, at
 * most 40 lookups per server and 200 in total per run, servers marked offline are skipped, the first
 * connection failure stops a server's lookups for the run, and a server that cannot answer the lookup
 * at all (no such route, answers outside the contract, refused credentials) in two runs in a row is
 * paused for an hour with a warning; a protocol whose lookups only fail for three runs in a row while
 * the server answers others gets a warning. Accounts are claimed by moving `checked_at` forward (FOR
 * UPDATE SKIP LOCKED), so several workers never check the same account twice; accounts a run did not
 * get to are put back in line, while an account whose lookup failed waits for the next interval.
 * Nothing secret is sent or logged.
 */

/** Lookups per run (one run a minute) across all servers… */
const CLAIM_LIMIT = 200;
/** …and per server, so a big server is spread over several runs instead of getting a burst. */
const PER_SERVER_LIMIT = 40;
/** One run stops starting new lookups after this long so it never holds a maintenance slot for minutes. */
const TIME_BUDGET_MS = 40_000;
/** Servers checked in parallel; the accounts of one server are looked up one at a time. */
const SERVER_CONCURRENCY = 6;
/** Removals of a protocol are held back when at least this many of its accounts are missing… */
const SUSPECT_MIN = 3;
/** …and they are at least this share of the accounts answered. */
const SUSPECT_SHARE = 0.5;
/** Removals of a protocol wait this long after one of its accounts was found again after a miss. */
const FALSE_MISS_HOLD_MS = 2 * 3_600_000;
/** Removals per server per hour: at least this many… */
const RATE_MIN = 10;
/** …or this share of its active accounts. */
const RATE_SHARE = 0.2;
const WARN_EVERY_SECONDS = 3600;
const PAUSE_SECONDS = 3600;
/** Sorted set: server id → until when (ms) the check skips it. */
const PAUSED_KEY = "account-check:paused";
/** Runs in a row in which a server could not answer any lookup, before it is paused. */
const PAUSE_AFTER_RUNS = 2;
/** Runs in a row in which one protocol's lookups only failed (others answering), before the admin is told. */
const PROTOCOL_WARN_AFTER_RUNS = 3;

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
  /** What the server said last time about a blocked account (see vpn_accounts.server_state). */
  serverState: string | null;
  serverStateReason: string | null;
  /** checked_at before this run claimed it, to put it back in line if it is not looked up. */
  prevCheckedAt: Date | null;
};

type Outcome = "found" | "missing" | "error";
type Ctx = { now: Date; started: number; budget: number; result: AccountCheckResult };

const lastCheck = sql`coalesce(${vpnAccounts.checkedAt}, ${vpnAccounts.activatedAt}, ${vpnAccounts.createdAt})`;

export async function checkAccounts(opts: { now?: Date; limit?: number; timeBudgetMs?: number } = {}): Promise<AccountCheckResult> {
  const result: AccountCheckResult = { checked: 0, missing: 0, removed: 0, held: 0, failed: 0 };
  const minutes = (await getSiteSettings()).health.accountCheckMinutes;
  if (!minutes) {
    // Turned off: nothing is "missing on server" any more (a cheap no-op once cleared).
    await db()
      .update(vpnAccounts)
      .set({ missingSince: null })
      .where(and(eq(vpnAccounts.status, "active"), isNotNull(vpnAccounts.missingSince)));
    return result;
  }
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
        serverState: vpnAccounts.serverState,
        serverStateReason: vpnAccounts.serverStateReason,
        prevCheckedAt: vpnAccounts.checkedAt,
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
      const outcomes = new Map<string, Outcome>();
      try {
        await checkServer(serverId, accounts, ctx, outcomes);
      } catch (e) {
        result.failed += accounts.filter((a) => !outcomes.has(a.id)).length;
        logger.warn("account check failed", { serverId, ...errorSummary(e) });
      } finally {
        // Accounts this run did not get to (time budget, connection failure) go back in line.
        await putBack(
          accounts.filter((a) => !outcomes.has(a.id)),
          now,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SERVER_CONCURRENCY, queue.length) }, work));
  return result;
}

async function checkServer(serverId: string, accounts: Claimed[], ctx: Ctx, outcomes: Map<string, Outcome>): Promise<void> {
  const { driver, server } = await getNodeDriver(serverId);
  let unsupported: { code: string; message: string } | null = null;
  /** First error message per protocol in this run. */
  const errors = new Map<string, string>();
  /** Accounts whose server state (banned, expired early, active again) changed in this run. */
  const changed: { account: Claimed; state: ServerState | null }[] = [];
  for (const a of accounts) {
    if (Date.now() - ctx.started > ctx.budget) break;
    try {
      const remote = await driver.getAccount(a.remoteAccountId ?? "");
      const found = !!remote && remote.status !== "revoked";
      outcomes.set(a.id, found ? "found" : "missing");
      ctx.result.checked++;
      // A found account may still be blocked on the server (banned by its multi-login limiter, expired
      // early): mirror that for display, and clear it once the server reports it active again.
      const state = remote && found ? serverStateOf(remote) : null;
      const sameState = !!state && state.state === a.serverState && state.reason === a.serverStateReason;
      await db()
        .update(vpnAccounts)
        .set(
          found
            ? {
                answeredAt: ctx.now,
                missingSince: null,
                serverState: state?.state ?? null,
                serverStateReason: state?.reason ?? null,
                serverStateUntil: state?.until ?? null,
                ...(sameState ? {} : { serverStateSince: state ? ctx.now : null }),
              }
            : { answeredAt: ctx.now, missingSince: a.missingSince ?? ctx.now },
        )
        .where(and(eq(vpnAccounts.id, a.id), eq(vpnAccounts.status, "active")));
      if (found && !sameState && (state || a.serverState)) changed.push({ account: a, state });
    } catch (e) {
      ctx.result.failed++;
      // Asked but no answer: it waits for the next interval (so one account that always times out does
      // not block its server every minute); the ones not asked yet go back in line.
      outcomes.set(a.id, "error");
      errors.set(a.protocolId, errors.get(a.protocolId) ?? (isNodeError(e) ? e.safeMessage : "Unexpected error."));
      if (isNodeError(e) && (e.kind === "connect" || e.kind === "timeout")) break; // the health monitor deals with the server
      if (isNodeError(e) && lookupUnsupported(e)) unsupported ??= { code: e.code, message: e.safeMessage };
    }
  }
  const found = accounts.filter((a) => outcomes.get(a.id) === "found");
  const missing = accounts.filter((a) => outcomes.get(a.id) === "missing");
  for (const c of changed) await logServerState(c.account, c.state, server.name);

  if (found.length || missing.length) await clearFailing(serverId);
  else if (unsupported && (await countFailing(serverId)) >= PAUSE_AFTER_RUNS) {
    // The server cannot answer the lookup at all: skip it for an hour instead of asking every interval.
    await pauseServer(serverId, ctx.now);
    await warn(
      serverId,
      "lookup_failing",
      `${server.name} could not answer the account lookups in ${PAUSE_AFTER_RUNS} checks in a row (${unsupported.message}). The account check skips this server for an hour, so accounts it deletes itself are not noticed. Update its node agent so GET /accounts/{id} answers as described in docs/10 and run node-selftest.py or npm run node:check.`,
      { code: unsupported.code },
    );
    return;
  }

  // A protocol whose lookups only fail while the server answers others: its deletions go unnoticed.
  for (const protocolId of new Set(accounts.filter((a) => outcomes.has(a.id)).map((a) => a.protocolId))) {
    const key = `${serverId}:${protocolId}`;
    if (accounts.some((a) => a.protocolId === protocolId && (outcomes.get(a.id) === "found" || outcomes.get(a.id) === "missing"))) {
      await clearFailing(key);
    } else if ((await countFailing(key)) >= PROTOCOL_WARN_AFTER_RUNS) {
      const [p] = await db().select({ name: protocols.name }).from(protocols).where(eq(protocols.id, protocolId)).limit(1);
      await warn(
        serverId,
        `protocol_failing:${protocolId}`,
        `${server.name} could not answer its ${p?.name ?? "VPN"} account lookups in ${PROTOCOL_WARN_AFTER_RUNS} checks in a row (${errors.get(protocolId) ?? "no answer"}), so ${p?.name ?? "those"} accounts it deletes itself are not noticed. Check GET /accounts/{id} for them on the server (node-selftest.py or npm run node:check).`,
        { reason: "protocol_failing", protocolId },
      );
    }
  }

  // Found again after a miss: this protocol's lookup is unreliable on this server for now.
  const foundAgain = found.filter((a) => a.missingSince);
  for (const protocolId of new Set(foundAgain.map((a) => a.protocolId))) {
    await db()
      .update(serverProtocols)
      .set({ accountLookupFalseMissAt: ctx.now })
      .where(and(eq(serverProtocols.serverId, serverId), eq(serverProtocols.protocolId, protocolId)));
    const again = foundAgain.filter((a) => a.protocolId === protocolId);
    await warn(
      serverId,
      `false_miss:${protocolId}`,
      `${server.name} said ${names(again)} did not exist, then found ${again.length === 1 ? "it" : "them"} again. Its lookup for this protocol looks unreliable, so its accounts are not removed for the next 2 hours.`,
      { reason: "false_miss", protocolId, accounts: again.map((a) => a.id) },
    );
  }

  if (!missing.length) return;
  ctx.result.missing += missing.length;
  // Missed on an earlier lookup too (at least one interval ago, since accounts are only due then).
  const confirmed = missing.filter((a) => a.missingSince);
  if (!confirmed.length) return;

  const byProtocol = new Map<string, Claimed[]>();
  for (const a of confirmed) byProtocol.set(a.protocolId, [...(byProtocol.get(a.protocolId) ?? []), a]);
  const removable: Claimed[] = [];
  for (const [protocolId, group] of byProtocol) {
    const [sp] = await db()
      .select({ suspectAt: serverProtocols.accountLookupSuspectAt, falseMissAt: serverProtocols.accountLookupFalseMissAt, name: protocols.name })
      .from(serverProtocols)
      .innerJoin(protocols, eq(protocols.id, serverProtocols.protocolId))
      .where(and(eq(serverProtocols.serverId, serverId), eq(serverProtocols.protocolId, protocolId)))
      .limit(1);
    const protocolName = sp?.name ?? "VPN";
    const reason = { protocolId, accounts: group.map((a) => a.id) };

    const stuck = sp?.suspectAt ? group.filter((a) => a.missingSince! <= sp.suspectAt!) : [];
    const rest = group.filter((a) => !stuck.includes(a));
    if (stuck.length) {
      hold(ctx, stuck);
      await warn(
        serverId,
        `suspect:${protocolId}`,
        `${names(stuck)} on ${server.name} went missing while its ${protocolName} lookup looked broken, so ${stuck.length === 1 ? "it is" : "they are"} not removed automatically. If the server really deleted ${stuck.length === 1 ? "it" : "them"}, revoke ${stuck.length === 1 ? "it" : "them"} in Admin → Accounts ("Missing on server").`,
        { reason: "suspect", ...reason },
      );
    }
    if (!rest.length) continue;

    if (sp?.falseMissAt && ctx.now.getTime() - sp.falseMissAt.getTime() < FALSE_MISS_HOLD_MS) {
      hold(ctx, rest);
      continue; // the false_miss warning already explains it
    }

    // The protocol's accounts that existed before these misses started and were answered since.
    const first = new Date(Math.min(...rest.map((a) => a.missingSince!.getTime())));
    const since = new Date(Math.max(...rest.map((a) => a.missingSince!.getTime())));
    const [c] = await db()
      .select({
        answered: sql<number>`count(*)::int`,
        // Found in a later run than the misses (a "found" from the same run may predate the breakage).
        found: sql<number>`(count(*) filter (where ${vpnAccounts.missingSince} is null and ${vpnAccounts.answeredAt} > ${since.toISOString()}::timestamptz))::int`,
      })
      .from(vpnAccounts)
      .where(
        and(
          eq(vpnAccounts.serverId, serverId),
          eq(vpnAccounts.protocolId, protocolId),
          eq(vpnAccounts.status, "active"),
          isNotNull(vpnAccounts.remoteAccountId),
          lt(vpnAccounts.activatedAt, first),
          gte(vpnAccounts.answeredAt, since),
        ),
      );
    const answered = c?.answered ?? 0;
    const foundSince = c?.found ?? 0;
    const missingNow = answered - foundSince;
    if (!foundSince) {
      hold(ctx, rest);
      await warn(
        serverId,
        `unconfirmed:${protocolId}`,
        `${server.name} says ${names(rest)} ${rest.length === 1 ? "does" : "do"} not exist, but it has not found any other ${protocolName} account that existed before, so a broken lookup cannot be ruled out and nothing was removed. If the server really deleted ${rest.length === 1 ? "it" : "them"}, revoke ${rest.length === 1 ? "it" : "them"} in Admin → Accounts ("Missing on server"); otherwise check GET /accounts/{id} on the server (node-selftest.py or npm run node:check).`,
        { reason: "unconfirmed", ...reason },
      );
      continue;
    }
    if (missingNow >= SUSPECT_MIN && missingNow >= answered * SUSPECT_SHARE) {
      await db()
        .update(serverProtocols)
        .set({ accountLookupSuspectAt: ctx.now })
        .where(and(eq(serverProtocols.serverId, serverId), eq(serverProtocols.protocolId, protocolId)));
      hold(ctx, rest);
      await warn(
        serverId,
        `too_many:${protocolId}`,
        `${server.name} says ${missingNow} of the ${answered} ${protocolName} accounts it was asked about do not exist (${names(rest)}…). That looks like a broken lookup rather than a login limiter, so none of them will be removed automatically. Check GET /accounts/{id} on the server; accounts it really deleted show as "Missing on server" in Admin → Accounts and can be revoked there.`,
        { reason: "too_many_missing", protocolId, missing: missingNow, answered },
      );
      continue;
    }
    removable.push(...rest);
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

type ServerState = { state: "disabled" | "expired"; reason: string | null; until: Date | null };

/** A found account the server does not let connect, or null when it says the account is active. */
function serverStateOf(remote: NodeAccount): ServerState | null {
  if (remote.status === "disabled") return { state: "disabled", reason: remote.disabledReason ?? null, until: remote.disabledUntil ?? null };
  // Only accounts that are still running here are looked up, so "expired" there means expired early.
  if (remote.status === "expired") return { state: "expired", reason: null, until: null };
  return null;
}

async function logServerState(account: Claimed, state: ServerState | null, serverName: string): Promise<void> {
  const [p] = await db().select({ name: protocols.name }).from(protocols).where(eq(protocols.id, account.protocolId)).limit(1);
  const what = `${p?.name ?? "VPN"} account${account.username ? ` ${account.username}` : ""} on ${serverName}`;
  const message = !state
    ? `${what} is no longer blocked by the server.`
    : state.state === "expired"
      ? `${what} has expired on the server before its expiry date here; it shows as "Expired on server" until it expires here too.`
      : state.reason === "multi_login"
        ? `${what} was banned by the server for multi-login${state.until ? ` until ${state.until.toISOString()}` : ""}.`
        : `${what} was blocked by the server${state.reason ? ` (${state.reason})` : ""}${state.until ? ` until ${state.until.toISOString()}` : ""}.`;
  await logEvent({
    event: "account.server_state",
    status: "info",
    level: state ? "warning" : "info",
    serverId: account.serverId,
    protocolId: account.protocolId,
    accountId: account.id,
    message,
    details: { state: state?.state ?? "active", reason: state?.reason ?? null },
  });
}

/** Errors that mean the server cannot answer the lookup at all (not a passing hiccup such as a 5xx). */
function lookupUnsupported(e: NodeError): boolean {
  if (e.kind === "protocol" || e.kind === "auth") return true;
  return (e.kind === "http" || e.kind === "remote") && [404, 405, 501].includes(e.status ?? 0);
}

function hold(ctx: Ctx, accounts: Claimed[]) {
  ctx.result.held += accounts.length;
}

function names(accounts: Claimed[]): string {
  const shown = accounts.slice(0, 5).map((a) => a.username ?? a.remoteAccountId ?? a.id);
  return accounts.length > 5 ? `${shown.join(", ")} and ${accounts.length - 5} more` : shown.join(", ");
}

/** Give accounts that were claimed but not looked up their previous check time back. */
async function putBack(accounts: Claimed[], now: Date): Promise<void> {
  for (const a of accounts) {
    try {
      await db()
        .update(vpnAccounts)
        .set({ checkedAt: a.prevCheckedAt })
        .where(and(eq(vpnAccounts.id, a.id), eq(vpnAccounts.checkedAt, now)));
    } catch (e) {
      logger.warn("account check could not put an account back in line", { accountId: a.id, ...errorSummary(e) });
    }
  }
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

/** Runs in a row in which a server (or "server:protocol") answered no lookup, this one included. */
async function countFailing(scope: string): Promise<number> {
  try {
    const key = `account-check:failing:${scope}`;
    const n = await redis().incr(key);
    await redis().expire(key, 2 * PAUSE_SECONDS);
    return n;
  } catch {
    return 0;
  }
}

async function clearFailing(scope: string): Promise<void> {
  try {
    await redis().del(`account-check:failing:${scope}`);
  } catch {
    // Nothing to do: the counter expires on its own.
  }
}

async function pauseServer(serverId: string, now: Date): Promise<void> {
  try {
    await redis().zadd(PAUSED_KEY, now.getTime() + PAUSE_SECONDS * 1000, serverId);
    await clearFailing(serverId);
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
