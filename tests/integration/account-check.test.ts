import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { provisioningLogs, provisioningRequests, serverProtocols, servers, vpnAccounts } from "@/server/db/schema";
import { redis } from "@/server/redis";
import { checkAccounts } from "@/server/provisioning/account-check";
import { expireAccounts, processExpiredRevokes } from "@/server/provisioning/expiry";
import { executeCreate, requestAccount } from "@/server/provisioning/service";
import { getSavedAccountStatuses } from "@/server/public/saved-status";
import { countBlockedAccounts, listAccounts, parseAccountFilters } from "@/server/accounts/queries";
import { publishServer, updateServerConnection } from "@/server/servers/service";
import { syncServer } from "@/server/servers/sync";
import { POST as savedStatusRoute } from "@/app/api/public/accounts/status/route";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";
import type { SavedAccountStatusResponse } from "@/lib/public/types";
import { actor, createServer, resetDatabase, SECRET, setSettings, startNode, teardown } from "../helpers";

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));

let ipCounter = 0;
/** A fresh client IP per account (per-IP daily limits). */
const nextIp = () => {
  const i = ipCounter++;
  return `100.65.${Math.floor(i / 250)}.${(i % 250) + 1}`;
};
const MINUTE = 60_000;
type MockNode = Awaited<ReturnType<typeof startNode>>;

describe("account check (accounts the server deleted itself)", () => {
  const nodes: MockNode[] = [];
  let n = 0;
  /** Every test runs at its own "now", far from the others and well after its accounts were created. */
  let clock = Date.now();
  const at = (minutes: number) => new Date(clock + minutes * MINUTE);
  const run = (minutes: number, opts: { limit?: number } = {}) => checkAccounts({ now: at(minutes), ...opts });

  /** A published server on its own mock node, so tests never share accounts. */
  const fleet = async (protocols: string[] = ["ssh"]) => {
    const node = await startNode({ protocols });
    nodes.push(node);
    n += 1;
    const s = await createServer(node.port, { name: `Check ${n}`, countryCode: "NL", maxAccounts: 1000 });
    await syncServer(s.id);
    await publishServer(s.id, actor);
    return { node, serverId: s.id };
  };
  const create = async (serverId: string, username: string, protocol = "ssh") => {
    const input = protocol === "ssh" ? { username, password: "S3cure-pass", duration: "3" } : { username, duration: "3" };
    const r = await requestAccount({ serverId, protocolSlug: protocol, input, idempotencyKey: randomUUID(), clientIp: nextIp() });
    await executeCreate(r.requestId);
    const [acc] = await db()
      .select()
      .from(vpnAccounts)
      .where(and(eq(vpnAccounts.username, username), eq(vpnAccounts.status, "active")));
    expect(acc).toBeDefined();
    return { ...acc!, requestId: r.requestId };
  };
  const many = async (serverId: string, prefix: string, count: number, protocol = "ssh") => {
    const out = [];
    for (let i = 0; i < count; i++) out.push(await create(serverId, `${prefix}${i}`, protocol));
    return out;
  };
  const row = async (id: string) => (await db().select().from(vpnAccounts).where(eq(vpnAccounts.id, id)))[0]!;
  const statuses = async (ids: string[]) => {
    const rows = await db().select({ id: vpnAccounts.id, s: vpnAccounts.status }).from(vpnAccounts).where(inArray(vpnAccounts.id, ids));
    return ids.map((id) => rows.find((r) => r.id === id)?.s);
  };
  const current = async (sid: string) => (await db().select({ n: servers.currentAccounts }).from(servers).where(eq(servers.id, sid)))[0]!.n;
  const lookups = (node: MockNode, remoteId: string) =>
    node.state.requestLog.filter((l) => l.method === "GET" && l.path === `/api/v1/accounts/${remoteId}`).length;
  const warnings = async (serverId: string) =>
    db()
      .select()
      .from(provisioningLogs)
      .where(and(eq(provisioningLogs.serverId, serverId), eq(provisioningLogs.event, "account.removed"), eq(provisioningLogs.status, "failure")));

  beforeAll(async () => {
    await resetDatabase();
  });
  beforeEach(async () => {
    await redis().flushdb();
    await setSettings({ health: { ...DEFAULT_SITE_SETTINGS.health, accountCheckMinutes: 5 } });
    clock += 2 * 60 * MINUTE; // two hours on (accounts last 3 days): earlier accounts are due, but each test has its own server
  });
  afterAll(async () => {
    for (const node of nodes) await node.close();
    await teardown();
  });

  it("does not look up a new account straight away, nor anything when the check is off", async () => {
    const { node, serverId } = await fleet();
    const acc = await create(serverId, "check_fresh");
    await db().update(vpnAccounts).set({ checkedAt: new Date() }).where(eq(vpnAccounts.status, "active")); // only the new account matters here
    await db().update(vpnAccounts).set({ checkedAt: null }).where(eq(vpnAccounts.id, acc.id));
    expect((await checkAccounts({ now: new Date() })).checked).toBe(0);
    expect(lookups(node, acc.remoteAccountId!)).toBe(0);

    await setSettings({ health: { ...DEFAULT_SITE_SETTINGS.health, accountCheckMinutes: 0 } });
    expect(await run(0)).toEqual({ checked: 0, missing: 0, removed: 0, held: 0, failed: 0 });
    expect(lookups(node, acc.remoteAccountId!)).toBe(0);
  });

  it("removes an account the server deleted on its next regular lookup, frees its slot and logs it", async () => {
    const { node, serverId } = await fleet();
    const [gone, ...rest] = await many(serverId, "check_gone", 4);
    await run(0); // all found: the server's SSH lookups are trusted
    node.state.accounts.delete(gone!.remoteAccountId!); // the server's multi-login limiter deleted it
    const before = await current(serverId);

    expect((await run(5)).missing).toBe(1); // first miss only
    expect(await row(gone!.id)).toMatchObject({ status: "active", holdsCapacity: true, missingSince: at(5) });
    await run(6);
    expect(lookups(node, gone!.remoteAccountId!)).toBe(2); // not due again a minute later

    await run(10);
    expect(await row(gone!.id)).toMatchObject({ status: "removed", holdsCapacity: false, missingSince: null, revokedAt: at(10), revokedBy: null });
    expect(await current(serverId)).toBe(before - 1);
    expect(await statuses(rest.map((a) => a.id))).toEqual(["active", "active", "active"]);
    const [event] = await db()
      .select()
      .from(provisioningLogs)
      .where(and(eq(provisioningLogs.accountId, gone!.id), eq(provisioningLogs.event, "account.removed")));
    expect(event!.message).toContain("check_gone0");

    // My accounts sees it as removed; later checks leave it alone.
    expect(await getSavedAccountStatuses([gone!.requestId])).toEqual({ [gone!.requestId]: { status: "removed", removedAt: at(10).toISOString() } });
    await run(20);
    expect(lookups(node, gone!.remoteAccountId!)).toBe(3);
  });

  it("still deletes a removed account on the server at its expiry date, unless its name is in use again", async () => {
    const { node, serverId } = await fleet();
    const [a, b, c] = await many(serverId, "check_exp", 3);
    await run(0);
    node.state.accounts.delete(a!.remoteAccountId!);
    node.state.accounts.delete(b!.remoteAccountId!);
    await run(5);
    await run(10);
    expect(await statuses([a!.id, b!.id])).toEqual(["removed", "removed"]);
    const reused = await create(serverId, "check_exp1"); // b's username, free again on the server
    await db()
      .update(vpnAccounts)
      .set({ expiresAt: new Date(Date.now() - MINUTE) })
      .where(inArray(vpnAccounts.id, [a!.id, b!.id]));

    expect((await expireAccounts()).revokesQueued).toBe(1);
    const queued = await db()
      .select()
      .from(provisioningRequests)
      .where(and(eq(provisioningRequests.operation, "revoke"), inArray(provisioningRequests.accountId, [a!.id, b!.id])));
    expect(queued.map((r) => r.accountId)).toEqual([a!.id]);
    await processExpiredRevokes();
    expect(node.state.requestLog.some((l) => l.method === "DELETE" && l.path === `/api/v1/accounts/${a!.remoteAccountId}`)).toBe(true);
    expect(
      (
        await db()
          .select()
          .from(provisioningRequests)
          .where(and(eq(provisioningRequests.accountId, a!.id), eq(provisioningRequests.operation, "revoke")))
      )[0]!.state,
    ).toBe("succeeded");
    expect((await expireAccounts()).revokesQueued).toBe(0); // queued once
    expect(await statuses([reused.id, c!.id])).toEqual(["active", "active"]);

    // A server that expires accounts itself gets no such request.
    const managed = await fleet();
    const [m1, ...mRest] = await many(managed.serverId, "check_exp_m", 3);
    await run(20);
    managed.node.state.accounts.delete(m1!.remoteAccountId!);
    await run(25);
    await run(30);
    expect((await row(m1!.id)).status).toBe("removed");
    await db()
      .update(servers)
      .set({ capabilities: { expiryManagedByNode: true } })
      .where(eq(servers.id, managed.serverId));
    await db()
      .update(vpnAccounts)
      .set({ expiresAt: new Date(Date.now() - MINUTE) })
      .where(eq(vpnAccounts.id, m1!.id));
    expect((await expireAccounts()).revokesQueued).toBe(0);
    expect(mRest).toHaveLength(2);

    // The name is taken again after the removal was queued for its expiry: nothing is sent.
    const late = await fleet();
    const [r, keep] = await many(late.serverId, "check_snd", 2);
    await run(40);
    late.node.state.accounts.delete(r!.remoteAccountId!);
    await run(45);
    await run(50);
    expect((await row(r!.id)).status).toBe("removed");
    await db()
      .update(vpnAccounts)
      .set({ expiresAt: new Date(Date.now() - MINUTE) })
      .where(eq(vpnAccounts.id, r!.id));
    expect((await expireAccounts()).revokesQueued).toBe(1);
    const again = await create(late.serverId, "check_snd0");
    await processExpiredRevokes();
    expect(late.node.state.requestLog.some((l) => l.method === "DELETE")).toBe(false);
    const [req] = await db()
      .select()
      .from(provisioningRequests)
      .where(and(eq(provisioningRequests.accountId, r!.id), eq(provisioningRequests.operation, "revoke")));
    expect(req).toMatchObject({ state: "succeeded", errorCode: "REUSED" });
    expect(await statuses([again.id, keep!.id])).toEqual(["active", "active"]);
  });

  it("counts an account the server reports as revoked as missing", async () => {
    const { node, serverId } = await fleet();
    const [revoked, ...others] = await many(serverId, "check_rv", 3);
    await run(0);
    node.state.accounts.get(revoked!.remoteAccountId!)!.status = "revoked";
    await run(5);
    await run(10);
    expect((await row(revoked!.id)).status).toBe("removed");
    expect(await statuses(others.map((a) => a.id))).toEqual(["active", "active"]);
  });

  it("forgets a miss when the account is found again, and then waits 2 hours before removing that protocol's accounts", async () => {
    const { node, serverId } = await fleet();
    const [gone, back, ...others] = await many(serverId, "check_fa", 4);
    await run(0);
    const saved = node.state.accounts.get(back!.remoteAccountId!)!;
    node.state.accounts.delete(gone!.remoteAccountId!);
    node.state.accounts.delete(back!.remoteAccountId!);
    await run(5);
    node.state.accounts.set(back!.remoteAccountId!, saved); // the lookup said "not found" for an account that exists
    await run(10);
    expect(await row(back!.id)).toMatchObject({ status: "active", missingSince: null, holdsCapacity: true });
    expect(await row(gone!.id)).toMatchObject({ status: "active", holdsCapacity: true }); // held: the lookup looks unreliable
    expect((await warnings(serverId)).some((w) => w.message.includes("found it again"))).toBe(true);
    await run(60);
    expect((await row(gone!.id)).status).toBe("active");
    await run(135);
    expect((await row(gone!.id)).status).toBe("removed");
    expect(await statuses(others.map((a) => a.id))).toEqual(["active", "active"]);
  });

  it("never acts on a bare 404 or a passing 500, and pauses a server that cannot answer the lookup twice in a row", async () => {
    const { node, serverId } = await fleet();
    const accs = await many(serverId, "check_404_", 2);
    await run(0);
    node.state.failLookups = 2; // one passing server error: no pause, asked again next interval
    await run(5);
    await run(10);
    expect(lookups(node, accs[0]!.remoteAccountId!)).toBe(3);
    expect(await warnings(serverId)).toHaveLength(0);

    node.state.noAccountLookup = true; // like an agent without GET /accounts/{id}
    await run(15);
    expect(await warnings(serverId)).toHaveLength(0); // once could be a hiccup
    await run(20);
    expect((await warnings(serverId))[0]!.message).toContain("could not answer the account lookups in 2 checks in a row");
    const asked = lookups(node, accs[0]!.remoteAccountId!);
    await run(25);
    await run(45);
    expect(lookups(node, accs[0]!.remoteAccountId!)).toBe(asked); // paused
    await run(81);
    expect(lookups(node, accs[0]!.remoteAccountId!)).toBe(asked + 1); // asked again after the hour
    for (const a of accs) expect(await row(a.id)).toMatchObject({ status: "active", missingSince: null });
  });

  it("skips offline servers", async () => {
    const { node, serverId } = await fleet();
    const acc = await create(serverId, "check_offline");
    await db().update(servers).set({ healthStatus: "offline" }).where(eq(servers.id, serverId));
    await run(0);
    expect(lookups(node, acc.remoteAccountId!)).toBe(0);
  });

  it("removes nothing unless another account of the same protocol that existed before has been found since", async () => {
    const { node, serverId } = await fleet(["ssh", "vless"]);
    await many(serverId, "check_pc_ssh", 8);
    const vless = await many(serverId, "check_pc_vl", 2, "vless");
    await run(0); // everything found
    for (const a of vless) node.state.accounts.delete(a.remoteAccountId!); // e.g. the agent can no longer read Xray's clients
    await run(5);
    await run(10);
    await run(15);
    expect(await statuses(vless.map((a) => a.id))).toEqual(["active", "active"]);
    expect((await row(vless[0]!.id)).missingSince).not.toBeNull(); // shown as "Missing on server"
    expect((await warnings(serverId)).some((w) => w.message.includes("has not found any other VLESS account"))).toBe(true);

    // Accounts created after the misses started do not count as evidence that the lookup works.
    const fresh = await create(serverId, "check_pc_vl_new", "vless");
    await db()
      .update(vpnAccounts)
      .set({ activatedAt: at(16) })
      .where(eq(vpnAccounts.id, fresh.id)); // signed up after the break
    await run(20);
    await run(25);
    expect(await statuses([...vless.map((a) => a.id), fresh.id])).toEqual(["active", "active", "active"]);
  });

  it("holds for good when too many of a protocol's accounts go missing at once, even after new accounts or revokes", async () => {
    const { node, serverId } = await fleet();
    const accs = await many(serverId, "check_tm", 10);
    await run(0);
    const gone = accs.slice(0, 6); // 6 of 10: a partly broken lookup rather than a limiter
    for (const a of gone) node.state.accounts.delete(a.remoteAccountId!);
    await run(5);
    await run(10);
    expect(await statuses(gone.map((a) => a.id))).toEqual(Array(6).fill("active"));
    expect((await warnings(serverId)).some((w) => w.message.includes("6 of the 10 SSH accounts"))).toBe(true);
    const [sp] = await db().select({ at: serverProtocols.accountLookupSuspectAt }).from(serverProtocols).where(eq(serverProtocols.serverId, serverId));
    expect(sp!.at).toEqual(at(10));

    // New, found accounts and an administrator revoking two of them do not release the others.
    const newer = await many(serverId, "check_tm_new", 12);
    await db()
      .update(vpnAccounts)
      .set({ activatedAt: at(11) })
      .where(
        inArray(
          vpnAccounts.id,
          newer.map((a) => a.id),
        ),
      );
    await db()
      .update(vpnAccounts)
      .set({ status: "revoked", revokedAt: at(11), holdsCapacity: false })
      .where(inArray(vpnAccounts.id, [gone[0]!.id, gone[1]!.id]));
    for (let m = 15; m <= 60; m += 5) await run(m);
    expect(await statuses(gone.slice(2).map((a) => a.id))).toEqual(Array(4).fill("active"));

    // Found again: no longer missing.
    const back = gone[2]!;
    node.state.accounts.set(back.remoteAccountId!, {
      ...node.state.accounts.values().next().value!,
      accountId: back.remoteAccountId!,
      username: back.username!,
    });
    await run(65);
    expect((await row(back.id)).missingSince).toBeNull();
  });

  it("removes nothing when the lookup of a big server breaks, with lookups spread over the interval", async () => {
    const { node, serverId } = await fleet();
    const accs = await many(serverId, "check_big", 100);
    const perRun = () => node.state.requestLog.filter((l) => l.method === "GET" && l.path.startsWith("/api/v1/accounts/")).length;
    // Steady state: at most 40 lookups per server and run, so the 100 accounts spread over the minutes.
    let seen = perRun();
    for (let m = 0; m < 12; m++) {
      await run(m);
      expect(perRun() - seen).toBeLessThanOrEqual(40);
      seen = perRun();
    }
    node.state.accounts.clear(); // e.g. a reinstalled agent lost its records while the VPN users still work
    for (let m = 12; m < 40; m++) {
      if (m === 20) {
        // Sign-ups after the break, found by the new agent.
        const newer = await many(serverId, "check_big_new", 15);
        await db()
          .update(vpnAccounts)
          .set({ activatedAt: at(20) })
          .where(
            inArray(
              vpnAccounts.id,
              newer.map((a) => a.id),
            ),
          );
      }
      await run(m);
      expect(perRun() - seen).toBeLessThanOrEqual(40);
      seen = perRun();
    }
    expect(new Set(await statuses(accs.map((a) => a.id)))).toEqual(new Set(["active"]));
    expect((await warnings(serverId)).length).toBeGreaterThan(0);
  });

  it("removes nothing when a broken lookup is cut short by the time budget, and gets to every account in the end", async () => {
    const { node, serverId } = await fleet();
    const accs = await many(serverId, "check_budget", 20);
    await run(0);
    node.state.accounts.clear();
    const before = new Map(accs.map((a) => [a.id, lookups(node, a.remoteAccountId!)]));
    node.state.latencyMs = 15;
    for (let m = 5; m < 65; m++) await checkAccounts({ now: at(m), timeBudgetMs: 20 }); // one or two lookups per run
    expect(new Set(await statuses(accs.map((a) => a.id)))).toEqual(new Set(["active"]));
    for (const a of accs) expect(lookups(node, a.remoteAccountId!)).toBeGreaterThan(before.get(a.id)!);
  });

  it("clears its per-protocol verdicts when the server's connection changes, and Missing marks when turned off", async () => {
    const { node, serverId } = await fleet();
    const [gone] = await many(serverId, "check_reset", 2);
    await run(0);
    node.state.accounts.delete(gone!.remoteAccountId!);
    await run(5);
    expect((await row(gone!.id)).missingSince).not.toBeNull();
    await db()
      .update(serverProtocols)
      .set({ accountLookupSuspectAt: at(5), accountLookupFalseMissAt: at(5) })
      .where(eq(serverProtocols.serverId, serverId));
    await updateServerConnection(
      serverId,
      {
        authMethod: "hmac_sha256",
        keyId: "mock-key",
        apiSecret: SECRET,
        tlsMode: "insecure_http",
        tlsServerName: null,
        caCertificatePem: null,
        pinnedFingerprintSha256: null,
        clientCertificatePem: null,
        clientKeyPem: null,
      },
      actor,
    );
    const flags = await db()
      .select({ s: serverProtocols.accountLookupSuspectAt, f: serverProtocols.accountLookupFalseMissAt })
      .from(serverProtocols)
      .where(eq(serverProtocols.serverId, serverId));
    expect(flags.every((x) => x.s === null && x.f === null)).toBe(true);

    await setSettings({ health: { ...DEFAULT_SITE_SETTINGS.health, accountCheckMinutes: 0 } });
    await run(6);
    expect(await row(gone!.id)).toMatchObject({ status: "active", missingSince: null });
  });

  it("does not take a 'found' answer from the same check as the first miss as proof that the lookup works", async () => {
    const { node, serverId } = await fleet();
    const [gone, b, c] = await many(serverId, "check_same", 3);
    await run(0);
    node.state.accounts.delete(gone!.remoteAccountId!);
    await run(5); // gone: first miss; b and c found in the same check
    // b and c are not looked up again before gone's second lookup (e.g. that check was cut short).
    await db()
      .update(vpnAccounts)
      .set({ checkedAt: at(9) })
      .where(inArray(vpnAccounts.id, [b!.id, c!.id]));
    await run(10);
    expect((await row(gone!.id)).status).toBe("active");
    await run(14); // b and c found after the miss
    await run(15);
    expect((await row(gone!.id)).status).toBe("removed");
  });

  it("tells the admin when one protocol's lookups keep failing while the server answers the others", async () => {
    const { node, serverId } = await fleet(["ssh", "vless"]);
    const ssh = await many(serverId, "check_pf_ssh", 2);
    const [vl] = await many(serverId, "check_pf_vl", 1, "vless");
    node.state.failLookupProtocols = [vl!.remoteAccountId ? node.state.accounts.get(vl!.remoteAccountId)!.protocol : "vless"];
    await run(0);
    await run(5);
    expect(await warnings(serverId)).toHaveLength(0);
    await run(10);
    expect((await warnings(serverId)).some((w) => w.message.includes("could not answer its VLESS account lookups in 3 checks in a row"))).toBe(true);
    expect(lookups(node, ssh[0]!.remoteAccountId!)).toBe(3); // the server itself is not paused
  });

  it("removes at most max(10, 20 %) accounts per server and hour, and the rest later", async () => {
    const { node, serverId } = await fleet();
    const accs = await many(serverId, "check_rate", 40);
    await run(0);
    const gone = accs.slice(0, 12); // 30 %: a busy limiter, not a broken lookup
    for (const a of gone) node.state.accounts.delete(a.remoteAccountId!);
    await run(5);
    await run(10);
    expect((await statuses(gone.map((a) => a.id))).filter((s) => s === "removed")).toHaveLength(10);
    await run(15); // still within the hour
    expect((await statuses(gone.map((a) => a.id))).filter((s) => s === "removed")).toHaveLength(10);
    expect((await warnings(serverId)).some((w) => w.message.includes("at most 10 per hour"))).toBe(true);
    await run(75);
    expect(await statuses(gone.map((a) => a.id))).toEqual(Array(12).fill("removed"));
    expect(await statuses(accs.slice(12).map((a) => a.id))).toEqual(Array(28).fill("active"));
  });

  it("caps lookups per server in the query, so a big server never crowds out a small one", async () => {
    const big = await fleet();
    const small = await fleet();
    const bigAccs = await many(big.serverId, "check_crowd_big", 45);
    const tiny = await many(small.serverId, "check_crowd_small", 2);
    // Only these two servers' accounts are due; the big server's are the oldest.
    await db()
      .update(vpnAccounts)
      .set({ checkedAt: at(0) })
      .where(eq(vpnAccounts.status, "active"));
    await db()
      .update(vpnAccounts)
      .set({ checkedAt: at(-20) })
      .where(
        inArray(
          vpnAccounts.id,
          bigAccs.map((a) => a.id),
        ),
      );
    await db()
      .update(vpnAccounts)
      .set({ checkedAt: at(-10) })
      .where(
        inArray(
          vpnAccounts.id,
          tiny.map((a) => a.id),
        ),
      );
    const r = await run(0, { limit: 42 });
    expect(r.checked).toBe(42);
    for (const a of tiny) expect(lookups(small.node, a.remoteAccountId!)).toBe(1);
  });

  it("shows an account the server banned for multi-login, keeps its slot, and clears it when the ban ends", async () => {
    const { node, serverId } = await fleet();
    const [banned, other] = await many(serverId, "check_ban", 2);
    await run(0);
    const before = await current(serverId);
    const na = node.state.accounts.get(banned!.remoteAccountId!)!;
    na.status = "disabled";
    na.disabledReason = "multi_login";
    na.disabledUntil = at(65);
    await run(5);
    expect(await row(banned!.id)).toMatchObject({
      status: "active",
      holdsCapacity: true,
      missingSince: null,
      serverState: "disabled",
      serverStateReason: "multi_login",
      serverStateSince: at(5),
      serverStateUntil: at(65),
    });
    expect(await current(serverId)).toBe(before);
    expect(await getSavedAccountStatuses([banned!.requestId, other!.requestId])).toEqual({
      [banned!.requestId]: { status: "suspended", reason: "multi_login", since: at(5).toISOString(), until: at(65).toISOString() },
      [other!.requestId]: { status: "active" },
    });
    const logged = async () =>
      (
        await db()
          .select()
          .from(provisioningLogs)
          .where(and(eq(provisioningLogs.accountId, banned!.id), eq(provisioningLogs.event, "account.server_state")))
      ).map((l) => l.message);
    expect((await logged()).some((m) => m.includes("banned by the server for multi-login"))).toBe(true);

    // Still banned at the next check: same "since", no new event.
    await run(10);
    expect((await row(banned!.id)).serverStateSince).toEqual(at(5));
    expect(await logged()).toHaveLength(1);

    // Admin → Accounts → "Blocked on server".
    const blocked = await listAccounts(parseAccountFilters({ blocked: "1", server: serverId }));
    expect(blocked.rows.map((r) => r.id)).toEqual([banned!.id]);
    expect(await countBlockedAccounts(parseAccountFilters({ server: serverId }))).toBe(1);

    // Ban lifted on the server.
    na.status = "active";
    delete na.disabledReason;
    delete na.disabledUntil;
    await run(15);
    expect(await row(banned!.id)).toMatchObject({
      status: "active",
      serverState: null,
      serverStateReason: null,
      serverStateSince: null,
      serverStateUntil: null,
    });
    expect(await getSavedAccountStatuses([banned!.requestId])).toEqual({ [banned!.requestId]: { status: "active" } });
    expect((await logged()).some((m) => m.includes("no longer blocked"))).toBe(true);
  });

  it("shows an account the server already expired before the expiry date here, without removing it", async () => {
    const { node, serverId } = await fleet();
    const [early] = await many(serverId, "check_early", 2);
    await run(0);
    node.state.accounts.get(early!.remoteAccountId!)!.status = "expired";
    await run(5);
    await run(10);
    expect(await row(early!.id)).toMatchObject({ status: "active", holdsCapacity: true, serverState: "expired", missingSince: null });
    expect(await getSavedAccountStatuses([early!.requestId])).toEqual({
      [early!.requestId]: { status: "suspended", reason: "expired", since: at(5).toISOString(), until: null },
    });
  });

  it("POST /api/public/accounts/status answers only the status of known accounts, for this site only", async () => {
    const { serverId } = await fleet();
    const ORIGIN = "http://localhost:3000";
    const post = (body: unknown, origin: string | null = ORIGIN) =>
      new Request(`${ORIGIN}/api/public/accounts/status`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": nextIp(), ...(origin ? { origin } : {}) },
        body: JSON.stringify(body),
      });
    const acc = await create(serverId, "check_status");
    const res = await savedStatusRoute(post({ ids: [acc.requestId, randomUUID(), "not-a-uuid"] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()) as SavedAccountStatusResponse).toEqual({ accounts: { [acc.requestId]: { status: "active" } } });

    expect((await savedStatusRoute(post({ ids: [acc.requestId] }, "https://evil.example"))).status).toBe(403);
    expect((await savedStatusRoute(post({ ids: Array.from({ length: 51 }, () => randomUUID()) }))).status).toBe(400);
    expect((await savedStatusRoute(post({ ids: [], extra: 1 }))).status).toBe(400);
  });
});
