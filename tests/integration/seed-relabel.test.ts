import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { protocolFields, protocols } from "@/server/db/schema";
import { seedProtocols } from "@/server/protocols/seed";
import { resetDatabase, teardown } from "../helpers";

describe("seed: reworded default labels", () => {
  beforeAll(async () => {
    await resetDatabase();
  });
  afterAll(async () => {
    await teardown();
  });

  const field = async (slug: string, key: string) => {
    const [p] = await db().select().from(protocols).where(eq(protocols.slug, slug));
    const [f] = await db()
      .select()
      .from(protocolFields)
      .where(and(eq(protocolFields.protocolId, p!.id), eq(protocolFields.key, key)));
    return { protocol: p!, field: f! };
  };

  it("renames the old bug-host defaults on built-in V2Ray protocols and keeps an admin's own wording", async () => {
    // A site seeded before the rewording: VMess and VLESS still carry the old defaults, Trojan has an admin's label.
    for (const slug of ["vmess", "vless"]) {
      const { protocol, field: f } = await field(slug, "sni_bug");
      await db().update(protocolFields).set({ label: "SNI / bug host" }).where(eq(protocolFields.id, f.id));
      const sniType = (await field(slug, "sni_type")).field;
      await db().update(protocolFields).set({ label: "Use the bug host as" }).where(eq(protocolFields.id, sniType.id));
      await db()
        .update(protocols)
        .set({ outputFields: protocol.outputFields.map((o) => (o.key === "bug_host" ? { ...o, label: "Bug host" } : o)) })
        .where(eq(protocols.id, protocol.id));
    }
    const trojan = (await field("trojan", "sni_bug")).field;
    await db().update(protocolFields).set({ label: "Host override" }).where(eq(protocolFields.id, trojan.id));

    const { upgraded } = await seedProtocols();
    expect(upgraded.sort()).toEqual(["vless", "vmess"]);
    for (const slug of ["vmess", "vless"]) {
      expect((await field(slug, "sni_bug")).field.label).toBe("Custom SNI / host");
      expect((await field(slug, "sni_type")).field.label).toBe("Use the custom host as");
      const { protocol } = await field(slug, "sni_bug");
      expect(protocol.outputFields.find((o) => o.key === "bug_host")?.label).toBe("Custom host");
    }
    expect((await field("trojan", "sni_bug")).field.label).toBe("Host override");

    // Running it again changes nothing.
    expect((await seedProtocols()).upgraded).toEqual([]);
  });
});
