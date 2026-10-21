import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { protocols } from "@/server/db/schema";
import { durationUsage, protocolsWithoutOpenDuration, setProtocolEnabled } from "@/server/protocols/service";
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
});
