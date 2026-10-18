import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolError } from "@/server/tools/errors";
import { parseIpInput, reverseLookup } from "@/server/tools/reverse";

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
      ip: "216.24.57.1",
      hostnames: [{ name: "ip-216-24-57-1.ingress.render.com", confirmed: true }],
      network: { asn: 397273, name: "RENDER", prefix: "216.24.56.0/21", country: "US" },
    });
  });

  it("returns the names, deduplicated, with forward confirmation", async () => {
    dns.reverse.mockResolvedValue(["dns.google.", "DNS.google", "other.example."]);
    dns.a.mockImplementation(async (name: string) => (name === "dns.google" ? ["8.8.4.4", "8.8.8.8"] : ["9.9.9.9"]));
    const r = await reverseLookup("8.8.8.8");
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
    const r = await reverseLookup("2606:4700:4700::1111");
    expect(r.hostnames).toEqual([{ name: "one.one.one.one", confirmed: true }]);
    expect(r.network).toEqual({ asn: 13335, name: "CLOUDFLARENET", prefix: "2606:4700::/44", country: "US" });
  });

  it("no reverse DNS is a normal answer: no hostnames, network still shown", async () => {
    dns.reverse.mockRejectedValue(fail("ENOTFOUND"));
    const r = await reverseLookup("216.24.57.1");
    expect(r.hostnames).toEqual([]);
    expect(r.network?.name).toBe("RENDER");
    dns.reverse.mockRejectedValue(fail("ENODATA"));
    expect((await reverseLookup("216.24.57.1")).hostnames).toEqual([]);
    dns.reverse.mockResolvedValue([]);
    expect((await reverseLookup("216.24.57.1")).hostnames).toEqual([]);
  });

  it("a name that fails to resolve is just not confirmed", async () => {
    dns.reverse.mockResolvedValue(["gone.example"]);
    dns.a.mockRejectedValue(fail("ENOTFOUND"));
    expect((await reverseLookup("1.2.3.4")).hostnames).toEqual([{ name: "gone.example", confirmed: false }]);
  });

  it("an unknown AS name still gives the ASN; a broken Team Cymru answer gives no network", async () => {
    dns.reverse.mockResolvedValue([]);
    dns.txt.mockImplementation(async (name: string) => {
      if (name.endsWith(".origin.asn.cymru.com")) return [["64500 64501 | 192.0.2.0/24 | ZZ | ripencc | "]];
      throw fail("ETIMEOUT");
    });
    expect((await reverseLookup("1.2.3.4")).network).toEqual({ asn: 64500, name: "", prefix: "192.0.2.0/24", country: "ZZ" });
    dns.txt.mockResolvedValue([["garbage"]]);
    expect((await reverseLookup("1.2.3.4")).network).toBeNull();
  });

  it("a DNS failure (not just 'no name') is an error", async () => {
    dns.reverse.mockRejectedValue(fail("ETIMEOUT"));
    const err = await reverseLookup("1.2.3.4").catch((e) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect(err).toMatchObject({ code: "DNS_FAILED", httpStatus: 502 });
  });
});
