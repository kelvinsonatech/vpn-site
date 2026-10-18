import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { dnsSightings } from "@/server/db/schema";
import { isPersonalName, purgeDnsSightings, registrableDomain } from "@/server/tools/sightings";
import { POST as hostnameToIp } from "@/app/api/public/tools/hostname-ip/route";
import { POST as ipToHostname } from "@/app/api/public/tools/ip-hostname/route";
import { resetDatabase, teardown } from "../helpers";

/**
 * The two DNS tools end to end (route handlers, Redis rate limit, PostgreSQL memory), with DNS
 * answers simulated: looking a website up with "Hostname to IP" lets "IP to Hostname" list it,
 * but only while it still points to that IP, and within the memory's caps.
 */

// after() needs a Next request scope: run the callbacks right away and let tests await them.
const pending: Promise<unknown>[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => void pending.push(Promise.resolve().then(fn)),
}));
const settle = async () => {
  await Promise.all(pending.splice(0));
};

// Simulated DNS: name → A records, IP → PTR names, Team Cymru TXT answers.
const A: Record<string, string[]> = {};
const PTR: Record<string, string[]> = {};
const TXT: Record<string, string[][]> = {
  "1.57.24.216.origin.asn.cymru.com": [["397273 | 216.24.56.0/21 | US | arin | 2020-03-12"]],
  "AS397273.asn.cymru.com": [["397273 | US | arin | 2020-03-12 | RENDER, US"]],
};
/** Names whose queries time out. */
const SLOW = new Set<string>();
const nxdomain = () => Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    async resolve4(name: string, opts?: { ttl?: boolean }) {
      if (SLOW.has(name)) throw Object.assign(new Error("ETIMEOUT"), { code: "ETIMEOUT" });
      const list = A[name];
      if (!list) throw nxdomain();
      return opts?.ttl ? list.map((address) => ({ address, ttl: 300 })) : list;
    }
    async resolve6() {
      throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
    }
    async resolveCname() {
      throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
    }
    async reverse(ip: string) {
      if (!PTR[ip]) throw nxdomain();
      return PTR[ip];
    }
    async resolveTxt(name: string) {
      if (!TXT[name]) throw nxdomain();
      return TXT[name];
    }
  },
}));

const ORIGIN = "http://localhost:3000";
let n = 0;
const post = (path: string, body: unknown, from = `198.51.100.${(++n % 250) + 1}`) =>
  new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": from },
    body: JSON.stringify(body),
  });
const lookupHost = async (hostname: string, from?: string) => {
  const res = await hostnameToIp(post("/api/public/tools/hostname-ip", { hostname }, from));
  await settle();
  return res;
};
const lookupIp = async (ip: string) => {
  const res = await ipToHostname(post("/api/public/tools/ip-hostname", { ip }));
  await settle();
  return { status: res.status, body: await res.json() };
};

describe("DNS tools", () => {
  beforeEach(async () => {
    await resetDatabase();
    for (const k of Object.keys(A)) delete A[k];
    for (const k of Object.keys(PTR)) delete PTR[k];
    SLOW.clear();
    A["screenclass.com"] = ["216.24.57.1"];
    A["ip-216-24-57-1.ingress.render.com"] = ["216.24.57.1"];
    PTR["216.24.57.1"] = ["ip-216-24-57-1.ingress.render.com"];
  });
  afterAll(teardown);

  it("216.24.57.1 → screenclass.com once screenclass.com has been looked up", async () => {
    // Before anyone looked it up, DNS alone only knows Render's name for the address.
    let r = await lookupIp("216.24.57.1");
    expect(r.status).toBe(200);
    expect(r.body.websites).toEqual([]);
    expect(r.body.hostnames).toEqual([{ name: "ip-216-24-57-1.ingress.render.com", confirmed: true }]);
    expect(r.body.network).toEqual({ asn: 397273, name: "RENDER", prefix: "216.24.56.0/21", country: "US" });

    expect((await lookupHost("https://screenclass.com/")).status).toBe(200);
    r = await lookupIp("216.24.57.1");
    expect(r.body.websites).toEqual(["screenclass.com"]);
    // Render's own name stays under reverse DNS, not duplicated as a website.
    expect(r.body.hostnames.map((h: { name: string }) => h.name)).toEqual(["ip-216-24-57-1.ingress.render.com"]);
  });

  it("lists every remembered website still on the IP, sorted", async () => {
    A["b-site.com"] = ["216.24.57.1", "216.24.57.253"];
    A["a-site.org"] = ["216.24.57.1"];
    for (const h of ["screenclass.com", "b-site.com", "a-site.org"]) await lookupHost(h);
    expect((await lookupIp("216.24.57.1")).body.websites).toEqual(["a-site.org", "b-site.com", "screenclass.com"]);
  });

  it("a website that moved away is not shown (checked live each time), and is forgotten", async () => {
    await lookupHost("screenclass.com");
    A["screenclass.com"] = ["93.184.215.14"];
    expect((await lookupIp("216.24.57.1")).body.websites).toEqual([]);
    expect(await db().select().from(dnsSightings)).toEqual([]);
  });

  it("a name that didn't answer this time is neither shown nor forgotten", async () => {
    await lookupHost("screenclass.com");
    SLOW.add("screenclass.com");
    expect((await lookupIp("216.24.57.1")).body.websites).toEqual([]);
    expect((await db().select().from(dnsSightings)).map((r) => r.hostname)).toEqual(["screenclass.com"]);
  });

  it("never remembers private addresses, and stores only hostname + IP", async () => {
    A["intranet.example.com"] = ["10.0.0.5"];
    await lookupHost("intranet.example.com");
    await lookupHost("screenclass.com");
    const rows = await db().select().from(dnsSightings);
    expect(rows.map((r) => [r.ip, r.hostname])).toEqual([["216.24.57.1", "screenclass.com"]]);
    expect(Object.keys(rows[0]!).sort()).toEqual(["domain", "firstSeen", "hostname", "ip", "lastSeen"]);
  });

  it("never remembers the asker's own address or dynamic-DNS names", async () => {
    // A name pointing at the asker's own connection is their own machine.
    const res = await lookupHost("screenclass.com", "216.24.57.1");
    expect((await res.json()).ipv4).toEqual([{ address: "216.24.57.1", ttl: 300, public: true }]);
    A["myhome.duckdns.org"] = ["81.2.69.160"];
    await lookupHost("myhome.duckdns.org");
    expect(await db().select().from(dnsSightings)).toEqual([]);
  });

  it("caps names per domain when storing, and lists at most two per domain", async () => {
    for (let i = 0; i < 22; i++) {
      A[`s${i}.wild.com`] = ["216.24.57.1"];
      await lookupHost(`s${i}.wild.com`);
    }
    const stored = await db().select().from(dnsSightings);
    expect(stored).toHaveLength(20);
    expect(new Set(stored.map((r) => r.domain))).toEqual(new Set(["wild.com"]));
    await db().execute(sql`update dns_sightings set last_seen = now() - interval '1 day'`);
    await db().execute(sql`update dns_sightings set last_seen = now() - interval '1 hour' where hostname = 's7.wild.com'`);
    // A name already stored is still refreshed at the cap.
    await lookupHost("s0.wild.com");
    await lookupHost("screenclass.com");
    // The two most recently looked-up wild.com names, plus the other domain.
    expect((await lookupIp("216.24.57.1")).body.websites).toEqual(["s0.wild.com", "s7.wild.com", "screenclass.com"]);
  });

  it("forgets names not looked up for 90 days: hidden at once, deleted by the hourly purge", async () => {
    A["kept.org"] = ["216.24.57.1"];
    await lookupHost("screenclass.com");
    await lookupHost("kept.org");
    await db().execute(sql`update dns_sightings set last_seen = now() - interval '91 days' where hostname = 'screenclass.com'`);
    expect((await lookupIp("216.24.57.1")).body.websites).toEqual(["kept.org"]);
    expect(await purgeDnsSightings()).toBe(1);
    expect((await db().select().from(dnsSightings)).map((r) => r.hostname)).toEqual(["kept.org"]);
  });
});

describe("sightings helpers", () => {
  it.each([
    ["screenclass.com", "screenclass.com"],
    ["www.a.b.example.com", "example.com"],
    ["shop.example.co.uk", "example.co.uk"],
    ["site.com.ng", "site.com.ng"],
    ["app.example.io", "example.io"],
  ])("registrableDomain(%s) → %s", (host, domain) => {
    expect(registrableDomain(host)).toBe(domain);
  });

  it("spots dynamic-DNS and tunnel names only", () => {
    for (const h of ["myhome.duckdns.org", "abc-def.trycloudflare.com", "1-2-3-4.nip.io", "nas.synology.me"]) expect(isPersonalName(h)).toBe(true);
    for (const h of ["screenclass.com", "notduckdns.org", "duckdns.org.example.com"]) expect(isPersonalName(h)).toBe(false);
  });
});
