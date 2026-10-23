import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { protocols, serverProtocols, vpnAccounts } from "@/server/db/schema";
import { redis } from "@/server/redis";
import { getProtocolWithFields, setProtocolEnabled, updateProtocol } from "@/server/protocols/service";
import { seedProtocols } from "@/server/protocols/seed";
import { executeCreate, getRequestStatus, requestAccount } from "@/server/provisioning/service";
import { publishServer } from "@/server/servers/service";
import { syncServer } from "@/server/servers/sync";
import { actor, createServer, listedServers, resetDatabase, startNode, teardown } from "../helpers";
import { OWNER_PROTOCOLS } from "../../mock-node/mock-node";

let ipCounter = 0;
const nextIp = () => `198.51.101.${++ipCounter}`;

describe("FastDNS (SlowDNS under another name)", () => {
  let node: Awaited<ReturnType<typeof startNode>>;
  let serverId: string;

  const protocolId = async (slug: string) => (await db().select({ id: protocols.id }).from(protocols).where(eq(protocols.slug, slug)))[0]!.id;
  const row = async (slug: string) =>
    (
      await db()
        .select()
        .from(serverProtocols)
        .where(and(eq(serverProtocols.serverId, serverId), eq(serverProtocols.protocolId, await protocolId(slug))))
    )[0];

  beforeAll(async () => {
    await resetDatabase();
    node = await startNode({ protocols: [...OWNER_PROTOCOLS] });
    const s = await createServer(node.port, { name: "FastDNS NL", maxAccounts: 50 });
    await syncServer(s.id);
    await publishServer(s.id, actor);
    serverId = s.id;
  });
  beforeEach(async () => {
    await redis().flushdb();
  });
  afterAll(async () => {
    await node.close();
    await teardown();
  });

  it("is detected wherever a server reports slowdns, with its node protocol, ports and state", async () => {
    const slow = (await row("slowdns"))!;
    const fast = (await row("fastdns"))!;
    expect(fast).toMatchObject({ detected: true, enabled: true, nodeIdentifier: "slowdns", serviceStatus: slow.serviceStatus });
    expect(fast.ports).toEqual(slow.ports);
    expect(fast.id).not.toBe(slow.id);
  });

  it("starts with SlowDNS's switch, durations and per-IP limit, so a SlowDNS that is off stays off", async () => {
    // As before FastDNS existed (no accounts yet, so its rows can go): SlowDNS turned off and tuned.
    await db().delete(protocols).where(eq(protocols.slug, "fastdns"));
    await db()
      .update(protocols)
      .set({ durationOptions: [1, 3], defaultDurationDays: 3, maxAccountsPerIpPerDay: 2 })
      .where(eq(protocols.slug, "slowdns"));
    await setProtocolEnabled(await protocolId("slowdns"), false, actor);
    try {
      const seeded = await seedProtocols();
      expect(seeded.created).toEqual(["fastdns"]);
      const [fast] = await db().select().from(protocols).where(eq(protocols.slug, "fastdns"));
      expect(fast).toMatchObject({ enabled: false, durationOptions: [1, 3], defaultDurationDays: 3, maxAccountsPerIpPerDay: 2 });
      expect(await listedServers("slowdns")).toEqual([]);
      expect(await listedServers("fastdns")).toEqual([]);
    } finally {
      await db()
        .update(protocols)
        .set({ durationOptions: [3, 7, 14, 30], defaultDurationDays: 7, maxAccountsPerIpPerDay: 3 })
        .where(eq(protocols.slug, "slowdns"));
      await setProtocolEnabled(await protocolId("slowdns"), true, actor);
    }
    await db()
      .update(protocols)
      .set({ durationOptions: [3, 7, 14, 30], defaultDurationDays: 7 })
      .where(eq(protocols.slug, "fastdns"));
    await setProtocolEnabled(await protocolId("fastdns"), true, actor);
    expect((await listedServers("fastdns")).length).toBe(1);
  });

  it("creates its accounts as slowdns accounts on the server, labelled FastDNS, with its own slots", async () => {
    const r = await requestAccount({
      serverId,
      protocolSlug: "fastdns",
      input: { username: "fastuser", password: "S3cure-pass", duration: "7" },
      idempotencyKey: randomUUID(),
      clientIp: nextIp(),
    });
    await executeCreate(r.requestId);
    const status = await getRequestStatus(r.requestId, r.claimToken);
    expect(status?.status).toBe("active");
    const account = status && "account" in status ? status.account! : null;
    expect(account?.protocol).toMatchObject({ slug: "fastdns", name: "FastDNS" });
    expect(account?.fields.find((f) => f.key === "slowdns_nameserver")?.label).toBe("FastDNS nameserver");

    const [acc] = await db().select().from(vpnAccounts).where(eq(vpnAccounts.username, "fastuser"));
    expect(acc).toMatchObject({ status: "active", protocolId: await protocolId("fastdns") });
    expect(node.state.accounts.get(acc!.remoteAccountId!)?.protocol).toBe("slowdns");
    expect((await row("fastdns"))!.currentAccounts).toBe(1);
    expect((await row("slowdns"))!.currentAccounts).toBe(0);
  });

  it("can be saved in the protocol editor next to SlowDNS", async () => {
    for (const slug of ["slowdns", "fastdns"]) {
      const { protocol: p, fields } = (await getProtocolWithFields({ slug }))!;
      const raw = {
        name: p.name,
        slug: p.slug,
        description: p.description,
        icon: p.icon,
        category: p.category,
        adapterKey: p.adapterKey,
        nodeIdentifiers: p.nodeIdentifiers,
        enabled: true,
        displayOrder: p.displayOrder,
        durationOptions: p.durationOptions,
        defaultDurationDays: p.defaultDurationDays,
        maxAccountsPerIpPerDay: p.maxAccountsPerIpPerDay,
        fields: fields.map((f) => ({ ...f, options: f.options ?? [], validation: f.validation ?? {} })),
        outputFields: p.outputFields,
      };
      await expect(updateProtocol(p.id, raw, actor), slug).resolves.toBeUndefined();
    }
  });

  it("on deploy gets a copy of each server's SlowDNS row once, and leaves existing rows alone", async () => {
    const fastId = await protocolId("fastdns");
    await db().delete(serverProtocols).where(eq(serverProtocols.protocolId, fastId)); // as before FastDNS existed
    await db()
      .update(serverProtocols)
      .set({ enabled: true, maxAccounts: 9, quotaLimit: 77 })
      .where(eq(serverProtocols.id, (await row("slowdns"))!.id));

    expect((await seedProtocols()).mirrored).toBe(1);
    const fast = (await row("fastdns"))!;
    expect(fast).toMatchObject({ enabled: true, detected: true, nodeIdentifier: "slowdns", maxAccounts: 9, quotaLimit: 77, currentAccounts: 0, quotaUsed: 0 });

    await db().update(serverProtocols).set({ enabled: false }).where(eq(serverProtocols.id, fast.id)); // the admin turns it off here
    expect((await seedProtocols()).mirrored).toBe(0);
    expect((await row("fastdns"))!.enabled).toBe(false);
  });

  it("goes away with SlowDNS when the server stops reporting it", async () => {
    node.state.protocols = OWNER_PROTOCOLS.filter((p) => p !== "slowdns");
    try {
      await syncServer(serverId);
      expect((await row("slowdns"))!.detected).toBe(false);
      expect((await row("fastdns"))!.detected).toBe(false);
    } finally {
      node.state.protocols = [...OWNER_PROTOCOLS];
      await syncServer(serverId);
    }
    expect((await row("fastdns"))!.detected).toBe(true);
  });
});
