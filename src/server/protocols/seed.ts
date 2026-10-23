import { and, eq, inArray } from "drizzle-orm";
import { db, type DbOrTx } from "@/server/db";
import { protocolFields, protocols, serverProtocols, type OutputFieldDefinition } from "@/server/db/schema";
import { getAdapter } from "@/server/provisioning/adapters/registry";
import { SSH_UPGRADE_OUTPUTS } from "@/server/provisioning/adapters/ssh";
import { V2RAY_UPGRADE_FIELDS, V2RAY_UPGRADE_OUTPUTS } from "@/server/provisioning/adapters/v2ray";
import type { SeedField } from "@/server/provisioning/types";
import { NODE_PROTOCOL_OF } from "@/lib/node-protocol-of";
import { PROTOCOL_SEEDS } from "./seed-data";

/**
 * Additions to built-in protocols made after their first release. Applied to existing databases by
 * seedProtocols(): missing input fields and output keys are added with the adapter's defaults;
 * anything that already exists (and every admin edit to it) is left alone. An output field that an
 * administrator removes comes back on the next seed, so hide it instead of removing it.
 */
const UPGRADES: Record<string, { outputs?: string[]; fields?: string[]; renamedOutputs?: Record<string, string> }> = {
  ssh: { outputs: SSH_UPGRADE_OUTPUTS, renamedOutputs: { ws_payload: "payload" } },
  "ssh-ssl": { outputs: SSH_UPGRADE_OUTPUTS, renamedOutputs: { ws_payload: "payload" } },
  "ssh-websocket": { outputs: SSH_UPGRADE_OUTPUTS, renamedOutputs: { ws_payload: "payload" } },
  slowdns: { outputs: SSH_UPGRADE_OUTPUTS, renamedOutputs: { ws_payload: "payload" } },
  fastdns: { outputs: SSH_UPGRADE_OUTPUTS },
  "udp-custom": { outputs: SSH_UPGRADE_OUTPUTS, renamedOutputs: { ws_payload: "payload" } },
  vmess: { outputs: V2RAY_UPGRADE_OUTPUTS, fields: V2RAY_UPGRADE_FIELDS },
  vless: { outputs: V2RAY_UPGRADE_OUTPUTS, fields: V2RAY_UPGRADE_FIELDS },
  trojan: { outputs: V2RAY_UPGRADE_OUTPUTS, fields: V2RAY_UPGRADE_FIELDS },
};

function fieldRow(protocolId: string, f: SeedField, displayOrder: number) {
  return {
    protocolId,
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder ?? null,
    helpText: f.helpText ?? null,
    options: f.options,
    validation: f.validation,
    defaultValue: f.defaultValue ?? null,
    displayOrder,
  };
}

/** Output definitions after applying renames and appending missing upgrade keys (null = unchanged). */
export function upgradeOutputFields(current: OutputFieldDefinition[], adapterKey: string): OutputFieldDefinition[] | null {
  const upgrade = UPGRADES[adapterKey];
  if (!upgrade) return null;
  const defaults = new Map(getAdapter(adapterKey).outputFields.map((f) => [f.key, f]));
  let changed = false;
  let next = current.map((f) => {
    const to = upgrade.renamedOutputs?.[f.key];
    if (!to || current.some((x) => x.key === to) || !defaults.has(to)) return f;
    changed = true;
    return { ...defaults.get(to)! };
  });
  for (const key of upgrade.outputs ?? []) {
    if (next.some((f) => f.key === key) || !defaults.has(key)) continue;
    next = [...next, { ...defaults.get(key)! }];
    changed = true;
  }
  return changed ? next : null;
}

async function upgradeExisting(tx: DbOrTx): Promise<string[]> {
  const upgraded: string[] = [];
  const seeds = PROTOCOL_SEEDS.filter((p) => UPGRADES[p.adapterKey]);
  const rows = await tx
    .select()
    .from(protocols)
    .where(inArray(protocols.slug, seeds.map((p) => p.slug)));
  for (const row of rows) {
    // Only built-in protocols that still use their original adapter are upgraded.
    const seed = seeds.find((p) => p.slug === row.slug);
    if (!seed || !row.isSystem || row.adapterKey !== seed.adapterKey) continue;
    let touched = false;

    const outputs = upgradeOutputFields(row.outputFields, row.adapterKey);
    if (outputs) {
      await tx.update(protocols).set({ outputFields: outputs }).where(eq(protocols.id, row.id));
      touched = true;
    }

    const wanted = UPGRADES[row.adapterKey]!.fields ?? [];
    if (wanted.length) {
      const existing = await tx.select().from(protocolFields).where(eq(protocolFields.protocolId, row.id));
      const missing = getAdapter(row.adapterKey).defaultFields.filter((f) => wanted.includes(f.key) && !existing.some((e) => e.key === f.key));
      if (missing.length) {
        // New optional fields go just before the duration field (or at the end).
        const duration = existing.find((e) => e.type === "duration");
        const maxOrder = Math.max(0, ...existing.map((e) => e.displayOrder));
        const base = duration ? duration.displayOrder - missing.length - 1 : maxOrder + 10;
        await tx
          .insert(protocolFields)
          .values(missing.map((f, i) => fieldRow(row.id, f, Math.max(0, base + i + 1))))
          .onConflictDoNothing();
        touched = true;
      }
    }
    if (touched) upgraded.push(row.slug);
  }
  return upgraded;
}

/** Move built-in protocols still on an earlier default icon to the current one (a chosen icon is kept). */
async function upgradeIcons(tx: DbOrTx): Promise<string[]> {
  const upgraded: string[] = [];
  for (const p of PROTOCOL_SEEDS) {
    if (!p.previousIcons?.length) continue;
    const rows = await tx
      .update(protocols)
      .set({ icon: p.icon })
      .where(and(eq(protocols.slug, p.slug), eq(protocols.isSystem, true), inArray(protocols.icon, p.previousIcons)))
      .returning({ slug: protocols.slug });
    upgraded.push(...rows.map((r) => r.slug));
  }
  return upgraded;
}

/**
 * Protocols that use another protocol's node protocol (NODE_PROTOCOL_OF, e.g. FastDNS on SlowDNS) get
 * a row on every server where that protocol was detected, with its switch, caps and detection, so they
 * show up without a sync. Existing rows are left alone (admin changes stay); syncs keep them current.
 */
async function mirrorNodeProtocolRows(tx: DbOrTx): Promise<number> {
  let added = 0;
  for (const [slug, baseSlug] of Object.entries(NODE_PROTOCOL_OF)) {
    const [alias] = await tx.select({ id: protocols.id }).from(protocols).where(eq(protocols.slug, slug)).limit(1);
    const [base] = await tx.select({ id: protocols.id }).from(protocols).where(eq(protocols.slug, baseSlug)).limit(1);
    if (!alias || !base) continue;
    const rows = await tx
      .select()
      .from(serverProtocols)
      .where(and(eq(serverProtocols.protocolId, base.id), eq(serverProtocols.detected, true)));
    if (!rows.length) continue;
    const now = new Date();
    const inserted = await tx
      .insert(serverProtocols)
      .values(
        rows.map((r) => ({
          serverId: r.serverId,
          protocolId: alias.id,
          enabled: r.enabled,
          detected: true,
          serviceStatus: r.serviceStatus,
          nodeIdentifier: r.nodeIdentifier,
          port: r.port,
          ports: r.ports,
          transports: r.transports,
          maxAccounts: r.maxAccounts,
          quotaLimit: r.quotaLimit,
          metadata: r.metadata,
          firstDetectedAt: now,
          lastDetectedAt: r.lastDetectedAt,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: serverProtocols.id });
    added += inserted.length;
  }
  return added;
}

/**
 * Insert the built-in protocols. Idempotent and non-destructive: missing protocols are created,
 * existing ones only receive the additions listed in UPGRADES (and a newer default icon while they
 * still use an earlier default); admin edits are never overwritten.
 */
export async function seedProtocols(tx: DbOrTx = db()): Promise<{ created: string[]; upgraded: string[]; mirrored: number }> {
  const created: string[] = [];
  for (const p of PROTOCOL_SEEDS) {
    const [row] = await tx
      .insert(protocols)
      .values({
        slug: p.slug,
        name: p.name,
        description: p.description,
        icon: p.icon,
        category: p.category,
        adapterKey: p.adapterKey,
        nodeIdentifiers: p.nodeIdentifiers,
        enabled: true,
        isSystem: true,
        displayOrder: p.displayOrder,
        durationOptions: p.durationOptions,
        defaultDurationDays: p.defaultDurationDays,
        outputFields: p.outputFields,
      })
      .onConflictDoNothing({ target: protocols.slug })
      .returning({ id: protocols.id });
    if (!row) continue;
    created.push(p.slug);
    await tx.insert(protocolFields).values(p.fields.map((f, i) => fieldRow(row.id, f, (i + 1) * 10)));
  }
  const upgraded = [...new Set([...(await upgradeExisting(tx)), ...(await upgradeIcons(tx))])].filter((slug) => !created.includes(slug));
  return { created, upgraded, mirrored: await mirrorNodeProtocolRows(tx) };
}

export async function protocolExists(slug: string) {
  const [row] = await db().select({ id: protocols.id }).from(protocols).where(eq(protocols.slug, slug)).limit(1);
  return !!row;
}
