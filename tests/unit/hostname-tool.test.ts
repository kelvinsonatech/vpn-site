import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolError } from "@/server/tools/errors";
import { isPublicAddress, lookupHostname, parseHostname } from "@/server/tools/hostname";

/** The "Hostname to IP" tool's input handling and public/private address labels. */

describe("parseHostname", () => {
  it.each([
    ["example.com", "example.com"],
    ["  Example.COM  ", "example.com"],
    ["www.example.com.", "www.example.com"],
    ["https://www.example.com/page?x=1#top", "www.example.com"],
    ["http://user:pass@example.com:8080/", "example.com"],
    ["example.com:8443", "example.com"],
    ["example.com/path", "example.com"],
    ["bücher.de", "xn--bcher-kva.de"],
    ["a-b.c-d.example.co.uk", "a-b.c-d.example.co.uk"],
  ])("%s → %s", (input, hostname) => {
    expect(parseHostname(input)).toEqual({ ok: true, hostname });
  });

  it("reports IP addresses instead of converting them", () => {
    expect(parseHostname("8.8.8.8")).toEqual({ ok: false, reason: "ip", ip: "8.8.8.8" });
    expect(parseHostname("[2606:4700::1111]")).toEqual({ ok: false, reason: "ip", ip: "2606:4700::1111" });
    expect(parseHostname("https://1.1.1.1/dns")).toEqual({ ok: false, reason: "ip", ip: "1.1.1.1" });
  });

  it.each(["", "   ", "localhost", "-bad.com", "bad-.com", "exa mple.com", "example..com", "example.123", `${"a".repeat(64)}.com`, `${"a.".repeat(130)}com`, "under_score.com", "http://"])(
    "rejects %j",
    (input) => {
      expect(parseHostname(input).ok).toBe(false);
    },
  );
});

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "1.1.1.1", "172.105.103.251", "2606:4700:4700::1111", "2001:4860:4860::8888"])("%s is public", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
  it.each(["10.1.2.3", "192.168.1.1", "172.16.5.4", "127.0.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:192.168.1.1", "not-an-ip"])(
    "%s is not public",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(false);
    },
  );
});

const dns = vi.hoisted(() => ({ a: vi.fn(), aaaa: vi.fn(), cname: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    resolve4 = dns.a;
    resolve6 = dns.aaaa;
    resolveCname = dns.cname;
  },
}));
const fail = (code: string) => Object.assign(new Error(code), { code });

describe("lookupHostname", () => {
  beforeEach(() => {
    dns.a.mockReset();
    dns.aaaa.mockReset();
    dns.cname.mockReset();
  });

  it("returns IPv4 and IPv6 addresses (deduplicated, labelled public or not) and the alias", async () => {
    dns.a.mockResolvedValue([
      { address: "142.250.1.1", ttl: 300 },
      { address: "142.250.1.1", ttl: 300 },
      { address: "10.0.0.5", ttl: 60 },
    ]);
    dns.aaaa.mockResolvedValue([{ address: "2a00:1450::200e", ttl: 300 }]);
    dns.cname.mockResolvedValue(["edge.example.net"]);
    await expect(lookupHostname("www.example.com")).resolves.toEqual({
      hostname: "www.example.com",
      aliasOf: "edge.example.net",
      ipv4: [
        { address: "142.250.1.1", ttl: 300, public: true },
        { address: "10.0.0.5", ttl: 60, public: false },
      ],
      ipv6: [{ address: "2a00:1450::200e", ttl: 300, public: true }],
    });
  });

  it("works with IPv4 only and no alias", async () => {
    dns.a.mockResolvedValue([{ address: "1.1.1.1", ttl: 30 }]);
    dns.aaaa.mockRejectedValue(fail("ENODATA"));
    dns.cname.mockRejectedValue(fail("ENODATA"));
    const r = await lookupHostname("one.example");
    expect(r.ipv6).toEqual([]);
    expect(r.aliasOf).toBeNull();
  });

  it.each([
    [["ENOTFOUND", "ENOTFOUND"], "NOT_FOUND", 404],
    [["ENODATA", "ENODATA"], "NO_ADDRESSES", 404],
    [["ETIMEOUT", "ETIMEOUT"], "DNS_FAILED", 502],
    [["ESERVFAIL", "ENODATA"], "DNS_FAILED", 502],
  ])("errors %j → %s", async ([c4, c6], code, status) => {
    dns.a.mockRejectedValue(fail(c4!));
    dns.aaaa.mockRejectedValue(fail(c6!));
    dns.cname.mockRejectedValue(fail("ENODATA"));
    const err = await lookupHostname("x.example").catch((e) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect(err).toMatchObject({ code, httpStatus: status });
  });
});
