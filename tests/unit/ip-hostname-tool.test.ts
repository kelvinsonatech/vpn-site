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

const dns = vi.hoisted(() => ({ reverse: vi.fn(), a: vi.fn(), aaaa: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    reverse = dns.reverse;
    resolve4 = dns.a;
    resolve6 = dns.aaaa;
  },
}));
const fail = (code: string) => Object.assign(new Error(code), { code });

describe("reverseLookup", () => {
  beforeEach(() => {
    dns.reverse.mockReset();
    dns.a.mockReset();
    dns.aaaa.mockReset();
  });

  it("returns the names, deduplicated, with forward confirmation", async () => {
    dns.reverse.mockResolvedValue(["dns.google.", "DNS.google", "other.example."]);
    dns.a.mockImplementation(async (name: string) => (name === "dns.google" ? ["8.8.4.4", "8.8.8.8"] : ["9.9.9.9"]));
    await expect(reverseLookup("8.8.8.8")).resolves.toEqual({
      ip: "8.8.8.8",
      hostnames: [
        { name: "dns.google", confirmed: true },
        { name: "other.example", confirmed: false },
      ],
    });
  });

  it("confirms IPv6 names against the canonical form", async () => {
    dns.reverse.mockResolvedValue(["one.one.one.one"]);
    dns.aaaa.mockResolvedValue(["2606:4700:4700:0:0:0:0:1111"]);
    const r = await reverseLookup("2606:4700:4700::1111");
    expect(r.hostnames).toEqual([{ name: "one.one.one.one", confirmed: true }]);
  });

  it("a name that fails to resolve is just not confirmed", async () => {
    dns.reverse.mockResolvedValue(["gone.example"]);
    dns.a.mockRejectedValue(fail("ENOTFOUND"));
    expect((await reverseLookup("1.2.3.4")).hostnames).toEqual([{ name: "gone.example", confirmed: false }]);
  });

  it.each([
    ["ENOTFOUND", "NO_HOSTNAME", 404],
    ["ENODATA", "NO_HOSTNAME", 404],
    ["ETIMEOUT", "DNS_FAILED", 502],
  ])("%s → %s", async (c, code, status) => {
    dns.reverse.mockRejectedValue(fail(c));
    const err = await reverseLookup("1.2.3.4").catch((e) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect(err).toMatchObject({ code, httpStatus: status });
  });

  it("an empty answer means no hostname", async () => {
    dns.reverse.mockResolvedValue([]);
    await expect(reverseLookup("1.2.3.4")).rejects.toMatchObject({ code: "NO_HOSTNAME" });
  });
});
