import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarSpan, daysBetween, formatSpan } from "@/lib/date-span";
import { ToolError } from "@/server/tools/errors";
import {
  lookupDomainAge,
  parseRdap,
  parseRegistryDate,
  parseSuffixList,
  parseWhois,
  registeredDomain,
  resetDomainAgeCaches,
} from "@/server/tools/domain-age";

// The per-registry budget lives in Redis; here each test decides whether it allows the query.
const budget = vi.hoisted(() => ({ allowed: true, keys: [] as string[] }));
vi.mock("@/server/auth/rate-limit", () => ({
  rateLimit: async (key: string) => {
    budget.keys.push(key);
    return { allowed: budget.allowed, remaining: 1, resetSeconds: 60 };
  },
}));

/** The "Domain Age" tool: registry date formats, RDAP and WHOIS parsing, lookup flow and the age arithmetic. */

// WHOIS over TCP: each test sets what each server answers.
const whois = vi.hoisted(() => ({ answers: new Map<string, (query: string) => string>(), queries: [] as string[] }));
vi.mock("node:net", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:net")>()),
  connect: ({ host }: { host: string }) => {
    const socket = Object.assign(new EventEmitter(), {
      setTimeout: () => socket,
      destroy: () => socket,
      end: (data: string) => {
        const query = data.trim();
        whois.queries.push(`${host} ${query}`);
        setTimeout(() => {
          const answer = whois.answers.get(host);
          if (!answer) return socket.emit("error", Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED" }));
          socket.emit("data", Buffer.from(answer(query)));
          socket.emit("close");
        }, 0);
      },
    });
    setTimeout(() => socket.emit("connect"), 0);
    return socket;
  },
}));

describe("parseRegistryDate", () => {
  it.each([
    ["1997-09-15T04:00:00Z", "1997-09-15T04:00:00.000Z"],
    ["2026-10-18T23:19:03.400848118Z", "2026-10-18T23:19:03.400Z"],
    ["2014-03-20T12:59:17.0Z", "2014-03-20T12:59:17.000Z"],
    ["2001-01-13 00:12:14", "2001-01-13T00:12:14.000Z"],
    ["2001-01-13 00:12:14 UTC", "2001-01-13T00:12:14.000Z"],
    ["2019-11-15T07:46:06+01:00", "2019-11-15T06:46:06.000Z"],
    ["2019-11-15T07:46:06-0500", "2019-11-15T12:46:06.000Z"],
    ["2002-12-04 00:00:00+02", "2002-12-03T22:00:00.000Z"],
    ["2001-01-13", "2001-01-13T00:00:00.000Z"],
    ["13-Jan-2001", "2001-01-13T00:00:00.000Z"],
    ["2001.01.13", "2001-01-13T00:00:00.000Z"],
    ["2001/01/13 10:00", "2001-01-13T00:00:00.000Z"],
    ["13.01.2001", "2001-01-13T00:00:00.000Z"],
  ])("%s → %s", (raw, iso) => {
    expect(parseRegistryDate(raw)).toBe(iso);
  });

  it.each([null, "", "never", "1970-01-01T00:00:00Z", "3999-01-01", "31/12/2001"])("rejects %s", (raw) => {
    expect(parseRegistryDate(raw)).toBeNull();
  });
});

/** Shaped like Verisign's answer for google.com. */
const GOOGLE = {
  objectClassName: "domain",
  ldhName: "GOOGLE.COM",
  status: ["client delete prohibited", "client transfer prohibited"],
  entities: [
    {
      roles: ["registrar"],
      vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "MarkMonitor Inc."]]],
      entities: [{ roles: ["abuse"], vcardArray: ["vcard", [["fn", {}, "text", ""], ["email", {}, "text", "abuse@example.com"]]] }],
    },
  ],
  events: [
    { eventAction: "registration", eventDate: "1997-09-15T04:00:00Z" },
    { eventAction: "expiration", eventDate: "2028-09-14T04:00:00Z" },
    { eventAction: "last changed", eventDate: "2019-09-09T15:39:04Z" },
    { eventAction: "last update of RDAP database", eventDate: "2026-10-18T23:17:46Z" },
  ],
  secureDNS: { delegationSigned: false },
  nameservers: [{ ldhName: "NS1.GOOGLE.COM" }, { ldhName: "NS2.GOOGLE.COM" }],
};

describe("parseRdap", () => {
  it("reads dates, registrar, name servers, status and DNSSEC (never contacts)", () => {
    expect(parseRdap(GOOGLE, "google.com")).toEqual({
      domain: "google.com",
      registered: "1997-09-15T04:00:00.000Z",
      expires: "2028-09-14T04:00:00.000Z",
      updated: "2019-09-09T15:39:04.000Z",
      registrar: "MarkMonitor Inc.",
      nameservers: ["ns1.google.com", "ns2.google.com"],
      status: ["client delete prohibited", "client transfer prohibited"],
      dnssec: false,
      source: "rdap",
    });
  });

  it("copes with registry differences: trailing dots, extra roles, registrar expiration, missing parts", () => {
    const r = parseRdap(
      {
        ldhName: "bbc.co.uk",
        entities: [{ roles: ["sponsor", "registrar"], vcardArray: ["vcard", [["fn", {}, "text", "NAMESHIELD"]]] }],
        events: [
          { eventAction: "registration", eventDate: "1994-12-13T03:49:48Z" },
          { eventAction: "registrar expiration", eventDate: "2034-12-13T03:49:48Z" },
        ],
        nameservers: [{ ldhName: "ddns0.bbc.co.uk." }, { ldhName: "DDNS0.BBC.CO.UK" }, { nope: 1 }],
      },
      "bbc.co.uk",
    );
    expect(r).toMatchObject({ registrar: "NAMESHIELD", expires: "2034-12-13T03:49:48.000Z", nameservers: ["ddns0.bbc.co.uk"], dnssec: null, status: [] });
    expect(parseRdap(null, "x.com")).toMatchObject({ domain: "x.com", registered: null, registrar: null, nameservers: [] });
    expect(parseRdap({ events: "nope", entities: [1, null], nameservers: {} }, "x.com").registered).toBeNull();
  });
});

describe("parseWhois", () => {
  it("reads ICANN-style answers (.io, .co, .me)", () => {
    const text = [
      "Domain Name: github.io",
      "Registry Domain ID: abc",
      "Updated Date: 2024-01-05T10:00:00Z",
      "Creation Date: 2013-03-08T21:59:34Z",
      "Registry Expiry Date: 2027-03-08T21:59:34Z",
      "Registrar: MarkMonitor Inc.",
      "Domain Status: clientTransferProhibited https://icann.org/epp#clientTransferProhibited",
      "Domain Status: clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited",
      "Registrant Email: someone@example.com",
      "Name Server: NS-1622.AWSDNS-10.CO.UK",
      "Name Server: dns1.p05.nsone.net",
      "DNSSEC: unsigned",
    ].join("\n");
    expect(parseWhois(text, "github.io")).toEqual({
      domain: "github.io",
      registered: "2013-03-08T21:59:34.000Z",
      expires: "2027-03-08T21:59:34.000Z",
      updated: "2024-01-05T10:00:00.000Z",
      registrar: "MarkMonitor Inc.",
      nameservers: ["ns-1622.awsdns-10.co.uk", "dns1.p05.nsone.net"],
      status: ["clientTransferProhibited", "clientDeleteProhibited"],
      dnssec: false,
      source: "whois",
    });
  });

  it("reads values written on the next line and lower-case keys", () => {
    const text = "Domain name:\n    example.gh\n\nRegistrar:\n    Example Registrar Ltd\n\nregistered:   13-Jan-2001\nexpires: 13.01.2030\nnserver: ns1.example.gh.\n";
    expect(parseWhois(text, "example.gh")).toMatchObject({
      registered: "2001-01-13T00:00:00.000Z",
      expires: "2030-01-13T00:00:00.000Z",
      registrar: "Example Registrar Ltd",
      nameservers: ["ns1.example.gh"],
    });
  });

  it("not registered → null; a registry without dates → a record with no dates", () => {
    expect(parseWhois("No match for \"NOPE-123.IO\".\n>>> Last update of WHOIS database", "nope-123.io")).toBeNull();
    expect(parseWhois("% Error: 55000000002 Connection refused; access control limit reached\nDomain: x.de\nStatus: free\n", "x.de")).toBeNull();
    expect(parseWhois("Domain: example.de\nNserver: ns1.example.de\nStatus: connect\nChanged: 2020-03-03T10:00:00+01:00\n", "example.de")).toMatchObject({
      registered: null,
      updated: "2020-03-03T09:00:00.000Z",
      status: ["connect"],
    });
  });
});

describe("parseWhois: registry layouts", () => {
  it("FRED/RIPE style: the domain's own date wins over contact objects' 'created' printed after it", () => {
    const text = [
      "domain:       example.cr",
      "registrant:   CONTACT-1",
      "nsset:        NSS-1",
      "registered:   17.11.2000 00:00:00",
      "expire:       17.11.2026",
      "",
      "contact:      CONTACT-1",
      "created:      03.09.2018 10:00:00",
      "",
      "nsset:        NSS-1",
      "nserver:      ns1.example.cr",
      "created:      01.01.2019 10:00:00",
    ].join("\n");
    expect(parseWhois(text, "example.cr")).toMatchObject({ registered: "2000-11-17T00:00:00.000Z", expires: "2026-11-17T00:00:00.000Z", nameservers: ["ns1.example.cr"] });
  });

  it("EURid / DNS Belgium: nested 'Registrar: / Name:' block and multi-line name server lists", () => {
    const text = [
      "Domain: google.eu",
      "Registrar:",
      "        Name: MarkMonitor Inc.",
      "        Website: https://www.markmonitor.com",
      "",
      "Name servers:",
      "        ns1.google.com",
      "        ns2.google.com",
      "",
      "Registered: Thu Jan 01 2004",
    ].join("\n");
    expect(parseWhois(text, "google.eu")).toMatchObject({ registrar: "MarkMonitor Inc.", nameservers: ["ns1.google.com", "ns2.google.com"] });
  });

  it("JPRS (.jp) bracketed lines and CNNIC (.cn) 'Expiration Time'", () => {
    const jp = ["[ JPRS database provides information on network administration. ]", "a. [Domain Name]                GOOGLE.JP", "[Name Server]                   ns1.google.com", "[Created on]                    2005/05/30", "[Expires on]                    2027/05/31", "[Status]                        Active", "[Last Updated]                  2026/06/01 01:05:04 (JST)"].join("\n");
    expect(parseWhois(jp, "google.jp")).toMatchObject({
      registered: "2005-05-30T00:00:00.000Z",
      expires: "2027-05-31T00:00:00.000Z",
      updated: "2026-06-01T00:00:00.000Z",
      nameservers: ["ns1.google.com"],
      status: ["Active"],
    });
    const cn = "Domain Name: google.cn\nRegistration Time: 2003-03-17 12:20:05\nExpiration Time: 2027-03-17 12:48:36\nSponsoring Registrar: MarkMonitor Inc.\n";
    expect(parseWhois(cn, "google.cn")).toMatchObject({ registered: "2003-03-17T12:20:05.000Z", expires: "2027-03-17T12:48:36.000Z", registrar: "MarkMonitor Inc." });
  });

  it("an answer with nothing recognisable parses to an empty record (the lookup refuses it)", () => {
    expect(parseWhois("% Error: 55000000002 Connection refused; access control limit reached.", "x.de")).toMatchObject({ registered: null, status: [], nameservers: [] });
    expect(parseWhois("", "x.de")).toMatchObject({ registered: null, registrar: null });
  });
});

describe("Public Suffix List", () => {
  const list = parseSuffixList(
    ["// ===BEGIN ICANN DOMAINS===", "com", "uk", "co.uk", "ltd.uk", "io", "*.ck", "!www.ck", "jp", "*.kawasaki.jp", "!city.kawasaki.jp", "公司.cn", "cn", "// ===END ICANN DOMAINS===", "github.io"].join("\n"),
  );
  it.each([
    ["www.google.com", "google.com"],
    ["a.b.example.co.uk", "example.co.uk"],
    ["www.example.ltd.uk", "example.ltd.uk"],
    ["someone.github.io", "github.io"],
    ["shop.example.co.ck", "example.co.ck"],
    ["www.ck", "www.ck"],
    ["a.city.kawasaki.jp", "city.kawasaki.jp"],
    ["x.foo.kawasaki.jp", "x.foo.kawasaki.jp"],
    ["xn--55qx5d.cn", null],
    ["example.xn--55qx5d.cn", "example.xn--55qx5d.cn"],
    ["co.uk", null],
    ["uk", null],
  ])("%s → %s", (host, domain) => {
    expect(registeredDomain(list, host)).toBe(domain);
  });
  it("reads only the ICANN section", () => {
    expect(list.rules.has("github.io")).toBe(false);
    expect(list.wildcards.has("ck")).toBe(true);
    expect(list.exceptions.has("www.ck")).toBe(true);
  });
});

describe("calendarSpan / formatSpan", () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  it.each([
    ["1997-09-15", "2026-10-18", { years: 29, months: 1, days: 3 }],
    ["2024-01-31", "2024-03-01", { years: 0, months: 1, days: 1 }],
    ["2020-02-29", "2021-02-28", { years: 1, months: 0, days: 0 }],
    ["2020-02-29", "2021-03-01", { years: 1, months: 0, days: 1 }],
    ["2025-12-31", "2026-02-28", { years: 0, months: 2, days: 0 }],
    ["2026-10-17", "2026-10-18", { years: 0, months: 0, days: 1 }],
    ["2026-10-18", "2026-10-18", { years: 0, months: 0, days: 0 }],
    ["2027-01-01", "2026-10-18", { years: 0, months: 0, days: 0 }],
  ])("%s → %s", (from, to, span) => {
    expect(calendarSpan(d(from), d(to))).toEqual(span);
  });

  it("formats with plurals and 'and'", () => {
    expect(formatSpan({ years: 29, months: 1, days: 3 })).toBe("29 years, 1 month and 3 days");
    expect(formatSpan({ years: 1, months: 0, days: 0 })).toBe("1 year");
    expect(formatSpan({ years: 0, months: 2, days: 1 })).toBe("2 months and 1 day");
    expect(formatSpan({ years: 0, months: 0, days: 0 })).toBe("0 days");
    expect(daysBetween(d("2026-10-17"), d("2026-10-18"))).toBe(1);
  });
});

describe("lookupDomainAge", () => {
  const fetchMock = vi.fn();
  /** url → [status, body, headers]; anything else is a 404. */
  let routes: Record<string, [number, unknown, Record<string, string>?]>;
  const BOOTSTRAP = {
    services: [
      [["com", "net"], ["https://rdap.verisign.example/com/v1/"]],
      [["uk"], ["http://rdap.nominet.example/uk/", "https://rdap.nominet.example/uk/"]],
    ],
  };
  // Enough rules to pass the sanity check, plus the ones the tests use.
  const SUFFIXES = [
    "// ===BEGIN ICANN DOMAINS===",
    ...Array.from({ length: 1000 }, (_, i) => `filler${i}`),
    ...["com", "net", "uk", "co.uk", "ltd.uk", "io", "de", "me", "zz"],
    "// ===END ICANN DOMAINS===",
  ].join("\n");
  const PSL = "https://publicsuffix.org/list/public_suffix_list.dat";

  beforeEach(() => {
    resetDomainAgeCaches();
    budget.allowed = true;
    budget.keys.length = 0;
    whois.answers.clear();
    whois.queries.length = 0;
    routes = { "https://data.iana.org/rdap/dns.json": [200, BOOTSTRAP], [PSL]: [200, SUFFIXES] };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: URL | string) => {
      const url = String(input);
      const [status, body, headers] = routes[url] ?? [404, { errorCode: 404 }];
      return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const fetched = () => fetchMock.mock.calls.map(([u]) => String(u));
  const VERISIGN = "https://rdap.verisign.example/com/v1/domain/";

  it("RDAP: subdomains are looked up as their registered domain; the https server is preferred", async () => {
    routes[`${VERISIGN}google.com`] = [200, GOOGLE];
    await expect(lookupDomainAge("www.google.com")).resolves.toMatchObject({ domain: "google.com", registered: "1997-09-15T04:00:00.000Z", source: "rdap" });
    routes["https://rdap.nominet.example/uk/domain/bbc.co.uk"] = [200, { ldhName: "bbc.co.uk", events: [{ eventAction: "registration", eventDate: "1994-12-13T03:49:48Z" }] }];
    await expect(lookupDomainAge("news.bbc.co.uk")).resolves.toMatchObject({ domain: "bbc.co.uk" });
    expect(fetched()).not.toContain("http://rdap.nominet.example/uk/domain/bbc.co.uk");
  });

  it("uses the Public Suffix List: one query for example.ltd.uk, never the zone (ltd.uk, co.uk) itself", async () => {
    routes["https://rdap.nominet.example/uk/domain/example.ltd.uk"] = [200, { ldhName: "example.ltd.uk" }];
    await expect(lookupDomainAge("www.example.ltd.uk")).resolves.toMatchObject({ domain: "example.ltd.uk" });
    expect(fetched().filter((u) => u.includes("/domain/"))).toEqual(["https://rdap.nominet.example/uk/domain/example.ltd.uk"]);
    routes["https://rdap.nominet.example/uk/domain/co.uk"] = [200, { ldhName: "co.uk" }];
    await expect(lookupDomainAge("nope-zz.co.uk")).rejects.toMatchObject({ code: "NOT_REGISTERED" });
    await expect(lookupDomainAge("co.uk")).rejects.toMatchObject({ code: "IS_SUFFIX", httpStatus: 400 });
    expect(fetched()).not.toContain("https://rdap.nominet.example/uk/domain/co.uk");
  });

  it("a made-up ending is refused before any registry is asked", async () => {
    await expect(lookupDomainAge("a.q0001")).rejects.toMatchObject({ code: "UNKNOWN_TLD", httpStatus: 400 });
    expect(whois.queries).toEqual([]);
    expect(fetched().filter((u) => u.includes("/domain/"))).toEqual([]);
  });

  it("without the suffix list, a heuristic guess is used and retried one label longer", async () => {
    routes[PSL] = [503, "down"];
    routes["https://rdap.nominet.example/uk/domain/example.ltd.uk"] = [200, { ldhName: "example.ltd.uk" }];
    await expect(lookupDomainAge("www.example.ltd.uk")).resolves.toMatchObject({ domain: "example.ltd.uk" });
    expect(fetched()).toContain("https://rdap.nominet.example/uk/domain/ltd.uk");
    // The failed list isn't downloaded again on the next lookup.
    await lookupDomainAge("www.example.ltd.uk");
    expect(fetched().filter((u) => u === PSL)).toHaveLength(1);
  });

  it("caches answers and both lists; concurrent lookups of one name share a single query", async () => {
    routes[`${VERISIGN}google.com`] = [200, GOOGLE];
    await Promise.all([lookupDomainAge("google.com"), lookupDomainAge("www.google.com"), lookupDomainAge("mail.google.com")]);
    await lookupDomainAge("google.com");
    expect(fetched().filter((u) => u.includes("dns.json"))).toHaveLength(1);
    expect(fetched().filter((u) => u === PSL)).toHaveLength(1);
    expect(fetched().filter((u) => u.includes("domain/google.com"))).toHaveLength(1);
  });

  it("not registered → NOT_REGISTERED (and the miss is cached briefly)", async () => {
    const err = await lookupDomainAge("zzqx-nope.com").catch((e) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect(err).toMatchObject({ code: "NOT_REGISTERED", httpStatus: 404 });
    await lookupDomainAge("zzqx-nope.com").catch(() => {});
    expect(fetched().filter((u) => u.endsWith("zzqx-nope.com"))).toHaveLength(1);
  });

  it("registry errors: 429 → REGISTRY_BUSY and a cool-down, 500 → REGISTRY_FAILED, broken JSON → REGISTRY_FAILED", async () => {
    routes[`${VERISIGN}busy.com`] = [429, {}, { "retry-after": "300" }];
    routes[`${VERISIGN}broken.com`] = [500, {}];
    routes[`${VERISIGN}garbage.com`] = [200, "<html>not json"];
    await expect(lookupDomainAge("busy.com")).rejects.toMatchObject({ code: "REGISTRY_BUSY", httpStatus: 503 });
    // Cooling down: the registry isn't asked again, for any name.
    routes[`${VERISIGN}google.com`] = [200, GOOGLE];
    await expect(lookupDomainAge("google.com")).rejects.toMatchObject({ code: "REGISTRY_BUSY" });
    expect(fetched().filter((u) => u.endsWith("google.com"))).toEqual([]);
    resetDomainAgeCaches();
    await expect(lookupDomainAge("broken.com")).rejects.toMatchObject({ code: "REGISTRY_FAILED", httpStatus: 502 });
    await expect(lookupDomainAge("garbage.com")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
  });

  it("every registry query passes the global per-host budget; over budget → REGISTRY_BUSY without a query", async () => {
    routes[`${VERISIGN}google.com`] = [200, GOOGLE];
    await lookupDomainAge("google.com");
    expect(budget.keys).toContain("tools:domain-age:host:rdap.verisign.example");
    budget.allowed = false;
    await expect(lookupDomainAge("other.com")).rejects.toMatchObject({ code: "REGISTRY_BUSY" });
    expect(fetched()).not.toContain(`${VERISIGN}other.com`);
  });

  it("follows at most two redirects, only to named hosts on the default port", async () => {
    routes[`${VERISIGN}moved.com`] = [302, "", { location: "https://rdap2.example/domain/moved.com" }];
    routes["https://rdap2.example/domain/moved.com"] = [200, { ldhName: "moved.com" }];
    await expect(lookupDomainAge("moved.com")).resolves.toMatchObject({ domain: "moved.com" });

    routes[`${VERISIGN}internal.com`] = [302, "", { location: "http://127.0.0.1/domain/internal.com" }];
    routes[`${VERISIGN}port.com`] = [302, "", { location: "https://evil.example:8443/x" }];
    routes[`${VERISIGN}loop.com`] = [302, "", { location: `${VERISIGN}loop.com` }];
    routes[`${VERISIGN}local.com`] = [302, "", { location: "http://localhost./x" }];
    for (const name of ["internal.com", "port.com", "loop.com", "local.com"]) await expect(lookupDomainAge(name)).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
    expect(fetched()).not.toContain("http://127.0.0.1/domain/internal.com");
    expect(fetched().filter((u) => u.endsWith("loop.com"))).toHaveLength(3);
  });

  it("refuses oversized answers", async () => {
    routes[`${VERISIGN}huge.com`] = [200, "x".repeat(600_000)];
    await expect(lookupDomainAge("huge.com")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
  });

  it("no IANA bootstrap (first start, network down) → REGISTRY_FAILED", async () => {
    routes["https://data.iana.org/rdap/dns.json"] = [503, {}];
    await expect(lookupDomainAge("google.com")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
  });

  it("TLDs without RDAP go to the WHOIS server IANA names for them", async () => {
    whois.answers.set("whois.iana.org", (q) => (q === "io" ? "domain: IO\nwhois: whois.nic.io\n" : `domain: ${q.toUpperCase()}\n`));
    whois.answers.set("whois.nic.io", (q) => (q === "github.io" ? "Domain Name: github.io\nCreation Date: 2013-03-08T21:59:34Z\nRegistrar: MarkMonitor Inc.\n" : 'No match for "X".'));
    await expect(lookupDomainAge("someone.github.io")).resolves.toMatchObject({ domain: "github.io", registered: "2013-03-08T21:59:34.000Z", source: "whois" });
    await expect(lookupDomainAge("nope-123.io")).rejects.toMatchObject({ code: "NOT_REGISTERED" });
    await expect(lookupDomainAge("example.zz")).rejects.toMatchObject({ code: "NO_REGISTRY_SERVICE", httpStatus: 422 });
    // IANA asked once per TLD.
    expect(whois.queries.filter((q) => q === "whois.iana.org io")).toHaveLength(1);
    expect(budget.keys).toContain("tools:domain-age:host:whois.nic.io");
  });

  it("an odd IANA answer is not cached as 'no WHOIS server'", async () => {
    let calls = 0;
    whois.answers.set("whois.iana.org", () => (++calls === 1 ? "" : "domain: ME\nwhois: whois.nic.me\n"));
    whois.answers.set("whois.nic.me", () => "Domain Name: example.me\nCreation Date: 2010-01-01T00:00:00Z\n");
    await expect(lookupDomainAge("example.me")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
    await expect(lookupDomainAge("example.me")).resolves.toMatchObject({ registered: "2010-01-01T00:00:00.000Z" });
  });

  it("empty or throttled WHOIS answers are refusals: REGISTRY_BUSY, never cached as a record", async () => {
    whois.answers.set("whois.iana.org", (q) => `domain: ${q.toUpperCase()}\nwhois: whois.${q === "de" ? "denic.de" : "nic.me"}\n`);
    whois.answers.set("whois.denic.de", () => "% Error: 55000000002 Connection refused; access control limit reached.");
    await expect(lookupDomainAge("example.de")).rejects.toMatchObject({ code: "REGISTRY_BUSY" });
    whois.answers.set("whois.nic.me", () => "");
    await expect(lookupDomainAge("example.me")).rejects.toMatchObject({ code: "REGISTRY_BUSY" });
    // Both servers now cool down; a later lookup asks again only after that.
    resetDomainAgeCaches();
    whois.answers.set("whois.nic.me", () => "Domain Name: example.me\nCreation Date: 2010-01-01T00:00:00Z\n");
    await expect(lookupDomainAge("example.me")).resolves.toMatchObject({ registered: "2010-01-01T00:00:00.000Z" });
  });

  it("DENIC gets its '-T dn' query form; JPRS gets '/e'; a refused connection → REGISTRY_FAILED", async () => {
    whois.answers.set("whois.iana.org", (q) => `domain: ${q.toUpperCase()}\nwhois: whois.${q === "de" ? "denic.de" : "nic.me"}\n`);
    whois.answers.set("whois.denic.de", () => "Domain: example.de\nNserver: ns1.example.de\nStatus: connect\n");
    await expect(lookupDomainAge("example.de")).resolves.toMatchObject({ registered: null, status: ["connect"] });
    expect(whois.queries).toContain("whois.denic.de -T dn example.de");
    await expect(lookupDomainAge("example.me")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
  });
});
