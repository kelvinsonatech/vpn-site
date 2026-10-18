import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolError } from "@/server/tools/errors";
import { MAX_WEBSITE_CHECKS, parseIpInput, reverseLookup } from "@/server/tools/reverse";

/** The "IP to Hostname" tool: accepted inputs, refused private addresses and forward confirmation. */

describe("parseIpInput", () => {
  it.each([
    ["8.8.8.8", "8.8.8.8"],
    ["  1.1.1.1  ", "1.1.1.1"],
    ["8.8.4.4:443", "8.8.4.4"],
    ["http://1.0.0.1/dns-query", "1.0.0.1"],
    ["[2606:4700:4700::1111]", "2606:4700:4700::1111"],
    ["2001:4860:4860:0:0:0:0:8888", "2001:4860:4860::8888"],
    ["2606:4700:4700::1111".toUpperCase(), "2606:4700:4700::1111"],
    ["::ffff:8.8.8.8", "8.8.8.8"],
  ])("%s → %s", (input, ip) => {
    expect(parseIpInput(input)).toEqual({ ok: true, ip });
  });

  it.each(["10.0.0.1", "192.168.1.1", "172.18.0.3", "127.0.0.1", "169.254.169.254", "100.64.1.1", "::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1"])("refuses private %s", (input) => {
    expect(parseIpInput(input)).toMatchObject({ ok: false, reason: "private" });
  });

  it("spots hostnames and nonsense", () => {
    expect(parseIpInput("example.com")).toEqual({ ok: false, reason: "hostname" });
    expect(parseIpInput("https://www.example.com/x")).toEqual({ ok: false, reason: "hostname" });
    for (const bad of ["", "999.1.1.1", "1.2.3", "hello", "1.2.3.4.5"]) expect(parseIpInput(bad).ok).toBe(false);
  });
});

const dns = vi.hoisted(() => ({ reverse: vi.fn(), a: vi.fn(), aaaa: vi.fn(), txt: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    reverse = dns.reverse;
    resolve4 = dns.a;
    resolve6 = dns.aaaa;
    resolveTxt = dns.txt;
  },
}));
const fail = (code: string) => Object.assign(new Error(code), { code });
const look = async (ip: string, candidates?: string[]) => (await reverseLookup(ip, candidates)).lookup;

/** Team Cymru answers for the Render ingress address 216.24.57.1. */
const CYMRU: Record<string, string[][]> = {
  "1.57.24.216.origin.asn.cymru.com": [["397273 | 216.24.56.0/21 | US | arin | 2020-03-12"]],
  "AS397273.asn.cymru.com": [["397273 | US | arin | 2020-03-12 | RENDER, US"]],
};

describe("reverseLookup", () => {
  beforeEach(() => {
    dns.reverse.mockReset();
    dns.a.mockReset();
    dns.aaaa.mockReset();
    dns.txt.mockReset();
    dns.txt.mockImplementation(async (name: string) => {
      if (CYMRU[name]) return CYMRU[name];
      throw fail("ENOTFOUND");
    });
  });

  it("a shared hosting address: the provider's name, verified, plus who owns the network", async () => {
    dns.reverse.mockResolvedValue(["ip-216-24-57-1.ingress.render.com"]);
    dns.a.mockResolvedValue(["216.24.57.1"]);
    await expect(reverseLookup("216.24.57.1")).resolves.toEqual({
      lookup: {
        ip: "216.24.57.1",
        websites: [],
        hostnames: [{ name: "ip-216-24-57-1.ingress.render.com", confirmed: true }],
        reverseDnsFailed: false,
        network: { asn: 397273, name: "RENDER", prefix: "216.24.56.0/21", country: "US" },
      },
      stale: [],
    });
  });

  it("returns the names, deduplicated, with forward confirmation", async () => {
    dns.reverse.mockResolvedValue(["dns.google.", "DNS.google", "other.example."]);
    dns.a.mockImplementation(async (name: string) => (name === "dns.google" ? ["8.8.4.4", "8.8.8.8"] : ["9.9.9.9"]));
    const r = await look("8.8.8.8");
    expect(r.hostnames).toEqual([
      { name: "dns.google", confirmed: true },
      { name: "other.example", confirmed: false },
    ]);
    expect(r.network).toBeNull();
  });

  it("confirms IPv6 names against the canonical form, and asks Team Cymru in nibble format", async () => {
    dns.reverse.mockResolvedValue(["one.one.one.one"]);
    dns.aaaa.mockResolvedValue(["2606:4700:4700:0:0:0:0:1111"]);
    dns.txt.mockImplementation(async (name: string) => {
      if (name === "1.1.1.1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.7.4.0.0.7.4.6.0.6.2.origin6.asn.cymru.com") return [["13335 | 2606:4700::/44 | US | arin | 2011-11-01"]];
      if (name === "AS13335.asn.cymru.com") return [["13335 | US | arin | 2010-07-14 | CLOUDFLARENET, US"]];
      throw fail("ENOTFOUND");
    });
    const r = await look("2606:4700:4700::1111");
    expect(r.hostnames).toEqual([{ name: "one.one.one.one", confirmed: true }]);
    expect(r.network).toEqual({ asn: 13335, name: "CLOUDFLARENET", prefix: "2606:4700::/44", country: "US" });
  });

  it("no reverse DNS is a normal answer: no hostnames, network still shown", async () => {
    dns.reverse.mockRejectedValue(fail("ENOTFOUND"));
    const r = await look("216.24.57.1");
    expect(r.hostnames).toEqual([]);
    expect(r.network?.name).toBe("RENDER");
    dns.reverse.mockRejectedValue(fail("ENODATA"));
    expect((await look("216.24.57.1")).hostnames).toEqual([]);
    dns.reverse.mockResolvedValue([]);
    expect((await look("216.24.57.1")).hostnames).toEqual([]);
  });

  it("a name that fails to resolve is just not confirmed", async () => {
    dns.reverse.mockResolvedValue(["gone.example"]);
    dns.a.mockRejectedValue(fail("ENOTFOUND"));
    expect((await look("1.2.3.4")).hostnames).toEqual([{ name: "gone.example", confirmed: false }]);
  });

  it("an unknown AS name still gives the ASN; a broken Team Cymru answer gives no network", async () => {
    dns.reverse.mockResolvedValue([]);
    dns.txt.mockImplementation(async (name: string) => {
      if (name.endsWith(".origin.asn.cymru.com")) return [["64500 64501 | 192.0.2.0/24 | ZZ | ripencc | "]];
      throw fail("ETIMEOUT");
    });
    expect((await look("1.2.3.4")).network).toEqual({ asn: 64500, name: "", prefix: "192.0.2.0/24", country: "ZZ" });
    dns.txt.mockResolvedValue([["garbage"]]);
    expect((await look("1.2.3.4")).network).toBeNull();
  });

  it("websites: remembered names are listed only if they still point here, sorted, without the PTR names; moved and gone ones are stale", async () => {
    dns.reverse.mockResolvedValue(["ip-216-24-57-1.ingress.render.com"]);
    const A: Record<string, string[]> = {
      "ip-216-24-57-1.ingress.render.com": ["216.24.57.1"],
      "screenclass.com": ["216.24.57.1"],
      "another.app": ["216.24.57.253", "216.24.57.1"],
      "moved.example": ["93.184.215.14"],
    };
    dns.a.mockImplementation(async (name: string) => {
      if (name === "slow.example") throw fail("ETIMEOUT");
      if (name === "v6only.example") throw fail("ENODATA");
      if (!A[name]) throw fail("ENOTFOUND");
      return A[name];
    });
    const { lookup, stale } = await reverseLookup("216.24.57.1", [
      "screenclass.com",
      "moved.example",
      "gone.example",
      "slow.example",
      "v6only.example",
      "another.app",
      "screenclass.com",
      "ip-216-24-57-1.ingress.render.com",
    ]);
    expect(lookup.websites).toEqual(["another.app", "screenclass.com"]);
    expect(lookup.hostnames).toEqual([{ name: "ip-216-24-57-1.ingress.render.com", confirmed: true }]);
    // A name that didn't answer is neither listed nor forgotten.
    expect(stale).toEqual(["moved.example", "gone.example", "v6only.example"]);
  });

  it("checks at most MAX_WEBSITE_CHECKS remembered names", async () => {
    dns.reverse.mockRejectedValue(fail("ENOTFOUND"));
    dns.a.mockResolvedValue(["1.2.3.4"]);
    const many = Array.from({ length: MAX_WEBSITE_CHECKS + 10 }, (_, i) => `site${String(i).padStart(2, "0")}.example`);
    const r = await look("1.2.3.4", many);
    expect(r.websites).toHaveLength(MAX_WEBSITE_CHECKS);
    expect(dns.a).toHaveBeenCalledTimes(MAX_WEBSITE_CHECKS);
  });

  it("a reverse DNS failure (not just 'no name') still shows the network and websites, flagged", async () => {
    dns.reverse.mockRejectedValue(fail("ESERVFAIL"));
    const r = await look("216.24.57.1");
    expect(r).toMatchObject({ hostnames: [], reverseDnsFailed: true, network: { name: "RENDER" } });
    dns.txt.mockRejectedValue(fail("ETIMEOUT"));
    dns.a.mockResolvedValue(["216.24.57.1"]);
    expect(await look("216.24.57.1", ["screenclass.com"])).toMatchObject({ websites: ["screenclass.com"], reverseDnsFailed: true, network: null });
  });

  it("is an error when every query failed", async () => {
    dns.reverse.mockRejectedValue(fail("ETIMEOUT"));
    dns.a.mockRejectedValue(fail("ETIMEOUT"));
    const err = await reverseLookup("1.2.3.4", ["screenclass.com"]).catch((e) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect(err).toMatchObject({ code: "DNS_FAILED", httpStatus: 502 });
  });
});
