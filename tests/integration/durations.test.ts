import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { protocolFields, protocols, siteSettings, type JsonObject } from "@/server/db/schema";
import { durationUsage, getProtocolWithFields, protocolsWithoutOpenDuration, setProtocolEnabled, updateProtocol } from "@/server/protocols/service";
import { requestAccount } from "@/server/provisioning/service";
import { clearSiteSettingsCache } from "@/server/settings/service";
import { actor, resetDatabase, setSettings, teardown } from "../helpers";

describe("locked durations (admin side)", () => {
  beforeAll(async () => {
    await resetDatabase();
  });
  afterAll(async () => {
    await teardown();
  });

  it("lists every duration enabled protocols offer, with the protocols offering it", async () => {
    const usage = await durationUsage();
    expect(usage.map((u) => u.days)).toEqual([3, 7, 14, 30]);
    expect(usage[0]!.protocols).toContain("SSH");
  });

  it("names the enabled protocols a lock would leave without any open duration", async () => {
    expect(await protocolsWithoutOpenDuration([])).toEqual([]);
    expect(await protocolsWithoutOpenDuration([7, 14, 30])).toEqual([]);
    const stuck = await protocolsWithoutOpenDuration([3, 7, 14, 30]);
    expect(stuck).toContain("SSH");
    expect(stuck).toContain("VLESS");
  });

  it("refuses to enable a protocol whose every duration is locked", async () => {
    const [ssh] = await db().select({ id: protocols.id }).from(protocols).where(eq(protocols.slug, "ssh"));
    await setProtocolEnabled(ssh!.id, false, actor);
    await setSettings({ lockedDurations: [3, 7, 14, 30] });
    try {
      await expect(setProtocolEnabled(ssh!.id, true, actor)).rejects.toThrow(/locked in Settings/);
      await setSettings({ lockedDurations: [7, 14, 30] });
      await expect(setProtocolEnabled(ssh!.id, true, actor)).resolves.toBeUndefined();
    } finally {
      await setSettings({ lockedDurations: [] });
    }
  });

  it("refuses to save an enabled protocol whose every duration is locked", async () => {
    const { protocol: p, fields } = (await getProtocolWithFields({ slug: "ssh" }))!;
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
      durationOptions: [7, 14],
      defaultDurationDays: 7,
      maxAccountsPerIpPerDay: p.maxAccountsPerIpPerDay,
      fields: fields.map((f) => ({ ...f, options: f.options ?? [], validation: f.validation ?? {} })),
      outputFields: p.outputFields,
    };
    await setSettings({ lockedDurations: [7, 14, 30] });
    try {
      await expect(updateProtocol(p.id, raw, actor)).rejects.toThrow(/locked in Settings/);
      await expect(updateProtocol(p.id, { ...raw, durationOptions: [3, 7, 14] }, actor)).resolves.toBeUndefined();
    } finally {
      await setSettings({ lockedDurations: [] });
    }
  });

  it("a protocol without a duration field uses an open duration instead of its locked default", async () => {
    const { protocol: p } = (await getProtocolWithFields({ slug: "ssh" }))!;
    await db()
      .delete(protocolFields)
      .where(and(eq(protocolFields.protocolId, p.id), eq(protocolFields.type, "duration")));
    const request = () =>
      requestAccount({
        serverId: randomUUID(),
        protocolSlug: "ssh",
        input: { username: "lock_fallback", password: "Sunrise-2026" },
        idempotencyKey: randomUUID().replace(/-/g, ""),
        clientIp: "192.0.2.77",
      });
    try {
      // Default 7 is locked but 3 is open: the duration check passes (the made-up server then is not found).
      await setSettings({ lockedDurations: [7, 14, 30] });
      await expect(request()).rejects.toMatchObject({ code: "SERVER_NOT_FOUND" });
      // Nothing open at all: refused before anything else.
      await setSettings({ lockedDurations: [3, 7, 14, 30] });
      await expect(request()).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { _form: [expect.stringMatching(/No account duration/)] } });
    } finally {
      await setSettings({ lockedDurations: [] });
    }
  });

  it("migration 0005 locks 7, 14 and 30 days on an existing site, once, unless a protocol would be left without a duration", async () => {
    const statement = readFileSync("drizzle/0005_lock_long_durations.sql", "utf8");
    const locked = async () => (await db().select({ data: siteSettings.data }).from(siteSettings))[0]?.data.lockedDurations;
    const run = async (data: JsonObject) => {
      await db().delete(siteSettings);
      await db().insert(siteSettings).values({ id: 1, data });
      await db().execute(sql.raw(statement));
      return locked();
    };
    try {
      expect(await run({ siteName: "Old site" })).toEqual([7, 14, 30]);
      expect(await run({ siteName: "Old site", lockedDurations: [] })).toEqual([]); // an admin's choice is kept
      const [ssh] = await db().select({ id: protocols.id, options: protocols.durationOptions }).from(protocols).where(eq(protocols.slug, "ssh"));
      await db()
        .update(protocols)
        .set({ durationOptions: [7, 14] })
        .where(eq(protocols.id, ssh!.id));
      expect(await run({ siteName: "Old site" })).toBeUndefined(); // SSH would have nothing open: skipped
      await db().update(protocols).set({ durationOptions: ssh!.options }).where(eq(protocols.id, ssh!.id));
    } finally {
      await db().delete(siteSettings);
      clearSiteSettingsCache();
    }
  });
});
