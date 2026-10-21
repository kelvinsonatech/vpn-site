import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { provisioningLogs, servers, vpnAccounts } from "@/server/db/schema";
import { redis } from "@/server/redis";
import { checkAccounts } from "@/server/provisioning/account-check";
import { expireAccounts } from "@/server/provisioning/expiry";
import { executeCreate, requestAccount } from "@/server/provisioning/service";
import { getSavedAccountStatuses } from "@/server/public/saved-status";
import { publishServer } from "@/server/servers/service";
import { syncServer } from "@/server/servers/sync";
import { POST as savedStatusRoute } from "@/app/api/public/accounts/status/route";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";
import type { SavedAccountStatusResponse } from "@/lib/public/types";
import { actor, createServer, resetDatabase, setSettings, startNode, teardown } from "../helpers";

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));

let ipCounter = 0;
const nextIp = () => `100.65.0.${++ipCounter}`;
const MINUTE = 60_000;

describe("account check (accounts the server deleted itself)", () => {
  let node: Awaited<ReturnType<typeof startNode>>;
  let bulkNode: Awaited<ReturnType<typeof startNode>>;
  let serverId: string;
  let bulkId: string;
  /** Each test runs at its own "now", far enough apart that earlier tests' accounts never interfere. */
  let clock = Date.now();
  const at = (offsetMs: number) => new Date(clock + offsetMs);

  const create = async (sid: string, username: string) => {
    const r = await requestAccount({
      serverId: sid,
      protocolSlug: "ssh",
      input: { username, password: "S3cure-pass", duration: "3" },
      idempotencyKey: randomUUID(),
      clientIp: nextIp(),
    });
    await executeCreate(r.requestId);
    const [acc] = await db().select().from(vpnAccounts).where(eq(vpnAccounts.username, username));
    expect(acc!.status).toBe("active");
    return { ...acc!, requestId: r.requestId };
  };
  const row = async (id: string) => (await db().select().from(vpnAccounts).where(eq(vpnAccounts.id, id)))[0]!;
  const current = async (sid: string) => (await db().select({ n: servers.currentAccounts }).from(servers).where(eq(servers.id, sid)))[0]!.n;
  const lookups = (n: typeof node, remoteId: string) =>
    n.state.requestLog.filter((l) => l.method === "GET" && l.path === `/api/v1/accounts/${remoteId}`).length;

  beforeAll(async () => {
    await resetDatabase();
    node = await startNode({ protocols: ["ssh"] });
    bulkNode = await startNode({ protocols: ["ssh"] });
    const a = await createServer(node.port, { name: "Check NL", countryCode: "NL" });
    const b = await createServer(bulkNode.port, { name: "Check FI", countryCode: "FI" });
    for (const s of [a, b]) {
      await syncServer(s.id);
      await publishServer(s.id, actor);
    }
    serverId = a.id;
    bulkId = b.id;
  });
  beforeEach(async () => {
    await redis().flushdb();
    await setSettings({ health: { ...DEFAULT_SITE_SETTINGS.health, accountCheckMinutes: 5 } });
    node.state.noAccountLookup = false;
    // Move every test 10 minutes on, so accounts from earlier tests are due again but already settled.
    clock += 10 * MINUTE;
  });
  afterAll(async () => {
    await node.close();
    await bulkNode.close();
    await teardown();
  });

  it("does not look up a new account straight away, nor anything when the check is off", async () => {
    const acc = await create(serverId, "check_fresh");
    expect((await checkAccounts({ now: new Date() })).checked).toBe(0);
    expect(lookups(node, acc.remoteAccountId!)).toBe(0);

    await setSettings({ health: { ...DEFAULT_SITE_SETTINGS.health, accountCheckMinutes: 0 } });
    expect(await checkAccounts({ now: at(0) })).toEqual({ checked: 0, missing: 0, removed: 0, held: 0, failed: 0 });
    expect(lookups(node, acc.remoteAccountId!)).toBe(0);
  });

  it("marks an account the server deleted as removed on the second miss, frees its slot and logs it", async () => {
    const acc = await create(serverId, "check_gone");
    await checkAccounts({ now: at(0) }); // settle everything else that is due
    node.state.accounts.delete(acc.remoteAccountId!); // the server's multi-login limiter deleted it
    const before = await current(serverId);

    clock += 10 * MINUTE;
    const first = await checkAccounts({ now: at(0) });
    expect(first.missing).toBe(1);
    expect(first.removed).toBe(0);
    expect(await row(acc.id)).toMatchObject({ status: "active", holdsCapacity: true, missingSince: at(0) });

    // Too soon for the second lookup: nothing happens.
    expect((await checkAccounts({ now: at(20_000) })).checked).toBe(0);

    const removedAt = at(MINUTE);
    const second = await checkAccounts({ now: removedAt });
    expect(second).toMatchObject({ missing: 1, removed: 1, held: 0 });
    expect(await row(acc.id)).toMatchObject({ status: "removed", holdsCapacity: false, missingSince: null, revokedAt: removedAt, revokedBy: null });
    expect(await current(serverId)).toBe(before - 1);
    const logs = await db()
      .select()
      .from(provisioningLogs)
      .where(and(eq(provisioningLogs.accountId, acc.id), eq(provisioningLogs.event, "account.removed")));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.message).toContain("check_gone");

    // Later checks and the expiry job leave it alone: no DELETE is queued for a removed account.
    expect(lookups(node, acc.remoteAccountId!)).toBe(3);
    clock += 10 * MINUTE;
    await checkAccounts({ now: at(0) });
    expect(lookups(node, acc.remoteAccountId!)).toBe(3);
    await db()
      .update(vpnAccounts)
      .set({ expiresAt: new Date(Date.now() - MINUTE) })
      .where(eq(vpnAccounts.id, acc.id));
    expect((await expireAccounts()).expired).toBe(0);

    // My accounts sees it as removed.
    expect(await getSavedAccountStatuses([acc.requestId])).toEqual({ [acc.requestId]: { status: "removed", removedAt: removedAt.toISOString() } });
  });

  it("counts an account the server reports as revoked as missing too", async () => {
    const acc = await create(serverId, "check_revoked");
    await checkAccounts({ now: at(0) });
    node.state.accounts.get(acc.remoteAccountId!)!.status = "revoked";
    clock += 10 * MINUTE;
    await checkAccounts({ now: at(0) });
    await checkAccounts({ now: at(MINUTE) });
    expect((await row(acc.id)).status).toBe("removed");
  });

  it("forgets a miss when the account is found again", async () => {
    const acc = await create(serverId, "check_back");
    await checkAccounts({ now: at(0) });
    const saved = node.state.accounts.get(acc.remoteAccountId!)!;
    node.state.accounts.delete(acc.remoteAccountId!);
    clock += 10 * MINUTE;
    await checkAccounts({ now: at(0) });
    expect((await row(acc.id)).missingSince).not.toBeNull();

    node.state.accounts.set(acc.remoteAccountId!, saved); // a hiccup on the server, not a deletion
    await checkAccounts({ now: at(MINUTE) });
    expect(await row(acc.id)).toMatchObject({ status: "active", missingSince: null, holdsCapacity: true });
  });

  it("never removes anything on a bare 404 (agent without the lookup route) or on an offline server", async () => {
    const acc = await create(serverId, "check_bare404");
    await checkAccounts({ now: at(0) });
    node.state.noAccountLookup = true;
    clock += 10 * MINUTE;
    const r = await checkAccounts({ now: at(0) });
    expect(r.missing).toBe(0);
    expect(r.failed).toBeGreaterThan(0);
    await checkAccounts({ now: at(11 * MINUTE) });
    expect(await row(acc.id)).toMatchObject({ status: "active", missingSince: null });

    node.state.noAccountLookup = false;
    const saved = node.state.accounts.get(acc.remoteAccountId!)!;
    node.state.accounts.delete(acc.remoteAccountId!);
    await db().update(servers).set({ healthStatus: "offline" }).where(eq(servers.id, serverId));
    try {
      clock += 30 * MINUTE;
      expect((await checkAccounts({ now: at(0) })).checked).toBe(0);
      expect((await row(acc.id)).missingSince).toBeNull();
    } finally {
      await db().update(servers).set({ healthStatus: "online" }).where(eq(servers.id, serverId));
      node.state.accounts.set(acc.remoteAccountId!, saved);
    }
  });

  it("holds removals and warns once when most of a server's accounts are missing at once", async () => {
    const accs = [];
    for (let i = 0; i < 6; i++) accs.push(await create(bulkId, `check_bulk${i}`));
    await checkAccounts({ now: at(0) });
    for (const a of accs) bulkNode.state.accounts.delete(a.remoteAccountId!); // e.g. a broken lookup that 404s everything
    clock += 10 * MINUTE;
    await checkAccounts({ now: at(0) });
    const second = await checkAccounts({ now: at(MINUTE) });
    expect(second.held).toBe(6);
    expect(second.removed).toBe(0);
    // Held misses are not looked up every minute: they wait for the normal interval like the rest.
    const before = lookups(bulkNode, accs[0]!.remoteAccountId!);
    await checkAccounts({ now: at(2 * MINUTE) });
    await checkAccounts({ now: at(3 * MINUTE) });
    expect(lookups(bulkNode, accs[0]!.remoteAccountId!)).toBe(before);
    expect((await checkAccounts({ now: at(7 * MINUTE) })).held).toBeGreaterThanOrEqual(6);
    expect(lookups(bulkNode, accs[0]!.remoteAccountId!)).toBe(before + 1);
    for (const a of accs) expect((await row(a.id)).status).toBe("active");
    const warnings = await db()
      .select()
      .from(provisioningLogs)
      .where(and(eq(provisioningLogs.serverId, bulkId), eq(provisioningLogs.event, "account.removed"), eq(provisioningLogs.level, "warning")));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("6 of its 6 active accounts");
  });

  it("does not trust misses from a server that has never confirmed an account exists", async () => {
    const fresh = await startNode({ protocols: ["ssh"] });
    try {
      const srv = await createServer(fresh.port, { name: "Check EE", countryCode: "EE" });
      await syncServer(srv.id);
      await publishServer(srv.id, actor);
      const acc = await create(srv.id, "check_untrusted");
      fresh.state.accounts.delete(acc.remoteAccountId!); // gone before the first lookup: could be a broken lookup
      clock += 10 * MINUTE;
      await checkAccounts({ now: at(0) });
      expect((await checkAccounts({ now: at(MINUTE) })).held).toBeGreaterThanOrEqual(1); // the bulk server's accounts are still held too
      expect(await row(acc.id)).toMatchObject({ status: "active", holdsCapacity: true });
      const [warning] = await db()
        .select()
        .from(provisioningLogs)
        .where(and(eq(provisioningLogs.serverId, srv.id), eq(provisioningLogs.event, "account.removed")));
      expect(warning?.message).toContain("has not yet confirmed that any account exists");

      // Once the server has found one account, its misses count.
      const other = await create(srv.id, "check_untrusted2");
      clock += 10 * MINUTE;
      await checkAccounts({ now: at(0) });
      expect((await db().select({ ok: servers.accountLookupOkAt }).from(servers).where(eq(servers.id, srv.id)))[0]!.ok).not.toBeNull();
      await checkAccounts({ now: at(MINUTE) });
      expect((await row(acc.id)).status).toBe("removed");
      expect((await row(other.id)).status).toBe("active");
    } finally {
      await fresh.close();
    }
  });

  it("caps the lookups per run", async () => {
    for (let i = 0; i < 3; i++) await create(serverId, `check_cap${i}`);
    clock += 10 * MINUTE;
    expect((await checkAccounts({ now: at(0), limit: 2 })).checked).toBe(2);
  });

  it("POST /api/public/accounts/status answers only the status of known accounts, for this site only", async () => {
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
