import { describe, expect, it } from "vitest";
import { matchProtocols, normalizeIdentifier } from "@/server/protocols/identifiers";

const protocols = [
  { id: "1", slug: "ssh", nodeIdentifiers: ["openssh", "dropbear"] },
  { id: "2", slug: "ssh-websocket", nodeIdentifiers: ["ssh-ws"] },
  { id: "3", slug: "vless", nodeIdentifiers: ["xray-vless"] },
];

describe("protocol identifier matching", () => {
  it("normalises case, underscores, spaces and dots", () => {
    expect(normalizeIdentifier(" SSH_WS ")).toBe("ssh-ws");
    expect(normalizeIdentifier("Xray.VLESS")).toBe("xray-vless");
  });
  it("maps aliases and reports unknown identifiers", () => {
    const { matches, unmapped } = matchProtocols(["SSH_WS", "dropbear", "XRAY_VLESS", "hysteria2"], protocols);
    expect(matches.get("2")?.identifier).toBe("SSH_WS");
    expect(matches.get("1")?.identifier).toBe("dropbear");
    expect(matches.get("3")?.identifier).toBe("XRAY_VLESS");
    expect(unmapped).toEqual(["hysteria2"]);
  });
  it("gives FastDNS SlowDNS's node protocol, unless the node reports fastdns itself", () => {
    const withDns = [...protocols, { id: "4", slug: "slowdns", nodeIdentifiers: ["dnstt"] }, { id: "5", slug: "fastdns", nodeIdentifiers: [] }];
    // Whichever order the rows come in.
    for (const list of [withDns, [...withDns].reverse()]) {
      const { matches, unmapped } = matchProtocols(["DNSTT", "ssh"], list);
      expect(matches.get("4")?.identifier).toBe("DNSTT");
      expect(matches.get("5")?.identifier).toBe("DNSTT");
      expect(unmapped).toEqual([]);
    }
    expect(matchProtocols(["ssh"], withDns).matches.has("5")).toBe(false); // no SlowDNS, no FastDNS
    expect(matchProtocols(["slowdns", "fastdns"], withDns).matches.get("5")?.identifier).toBe("fastdns");
  });
  it("prefers the exact slug when a node reports two identifiers for one protocol", () => {
    const { matches } = matchProtocols(["openssh", "ssh"], protocols);
    expect(matches.get("1")?.identifier).toBe("ssh");
  });
});
