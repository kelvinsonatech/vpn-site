import { NODE_PROTOCOL_OF } from "@/lib/node-protocol-of";

/** Normalise protocol identifiers reported by nodes: case, `_`, spaces and dots are ignored. */
export function normalizeIdentifier(id: string): string {
  return id.trim().toLowerCase().replace(/[\s_.]+/g, "-").replace(/-+/g, "-");
}

export interface ProtocolMatcher {
  id: string;
  slug: string;
  nodeIdentifiers: string[];
}

/**
 * Map node-reported identifiers to protocols. A protocol matches its slug and any of its
 * admin-editable `node_identifiers`. Returns the matches and the identifiers nobody claimed.
 */
export function matchProtocols<T extends ProtocolMatcher>(
  reported: string[],
  protocols: T[],
): { matches: Map<string, { protocol: T; identifier: string }>; unmapped: string[] } {
  const index = new Map<string, T>();
  for (const p of protocols) {
    for (const ident of [p.slug, ...p.nodeIdentifiers]) {
      const key = normalizeIdentifier(ident);
      if (!index.has(key)) index.set(key, p);
    }
  }
  const matches = new Map<string, { protocol: T; identifier: string }>();
  const unmapped: string[] = [];
  for (const raw of reported) {
    const p = index.get(normalizeIdentifier(raw));
    if (!p) {
      if (!unmapped.includes(raw)) unmapped.push(raw);
      continue;
    }
    // Prefer an exact slug match if a node reports two identifiers for one protocol.
    const existing = matches.get(p.id);
    if (!existing || normalizeIdentifier(raw) === p.slug) matches.set(p.id, { protocol: p, identifier: raw });
  }
  // A protocol riding on another one's node protocol matches wherever that one does, with the same
  // identifier (unless the node reports the protocol itself).
  for (const p of protocols) {
    const base = NODE_PROTOCOL_OF[p.slug];
    if (!base || matches.has(p.id)) continue;
    const baseMatch = [...matches.values()].find((m) => m.protocol.slug === base);
    if (baseMatch) matches.set(p.id, { protocol: p, identifier: baseMatch.identifier });
  }
  return { matches, unmapped };
}
