import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarSpan, daysBetween, formatSpan } from "@/lib/date-span";
import { ToolError } from "@/server/tools/errors";
import { lookupDomainAge, parseRdap, parseRegistryDate, parseWhois, resetDomainAgeCaches } from "@/server/tools/domain-age";

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

  beforeEach(() => {
    resetDomainAgeCaches();
    whois.answers.clear();
    whois.queries.length = 0;
    routes = { "https://data.iana.org/rdap/dns.json": [200, BOOTSTRAP] };
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

  it("RDAP: subdomains are looked up as their registered domain; the https server is preferred", async () => {
    routes["https://rdap.verisign.example/com/v1/domain/google.com"] = [200, GOOGLE];
    await expect(lookupDomainAge("www.google.com")).resolves.toMatchObject({ domain: "google.com", registered: "1997-09-15T04:00:00.000Z", source: "rdap" });
    routes["https://rdap.nominet.example/uk/domain/bbc.co.uk"] = [200, { ldhName: "bbc.co.uk", events: [{ eventAction: "registration", eventDate: "1994-12-13T03:49:48Z" }] }];
    await expect(lookupDomainAge("news.bbc.co.uk")).resolves.toMatchObject({ domain: "bbc.co.uk" });
    expect(fetched()).not.toContain("http://rdap.nominet.example/uk/domain/bbc.co.uk");
  });

  it("caches answers and IANA's list", async () => {
    routes["https://rdap.verisign.example/com/v1/domain/google.com"] = [200, GOOGLE];
    await lookupDomainAge("google.com");
    await lookupDomainAge("google.com");
    expect(fetched().filter((u) => u.includes("dns.json"))).toHaveLength(1);
    expect(fetched().filter((u) => u.includes("domain/google.com"))).toHaveLength(1);
  });

  it("not registered → NOT_REGISTERED; a wrong first guess is retried one label longer", async () => {
    const err = await lookupDomainAge("zzqx-nope.com").catch((e) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect(err).toMatchObject({ code: "NOT_REGISTERED", httpStatus: 404 });
    routes["https://rdap.nominet.example/uk/domain/example.ltd.uk"] = [200, { ldhName: "example.ltd.uk" }];
    await expect(lookupDomainAge("www.example.ltd.uk")).resolves.toMatchObject({ domain: "example.ltd.uk" });
    expect(fetched()).toContain("https://rdap.nominet.example/uk/domain/ltd.uk");
  });

  it("registry errors: 429 → REGISTRY_BUSY, 500 → REGISTRY_FAILED, broken JSON → REGISTRY_FAILED", async () => {
    routes["https://rdap.verisign.example/com/v1/domain/busy.com"] = [429, {}];
    routes["https://rdap.verisign.example/com/v1/domain/broken.com"] = [500, {}];
    routes["https://rdap.verisign.example/com/v1/domain/garbage.com"] = [200, "<html>not json"];
    await expect(lookupDomainAge("busy.com")).rejects.toMatchObject({ code: "REGISTRY_BUSY", httpStatus: 503 });
    await expect(lookupDomainAge("broken.com")).rejects.toMatchObject({ code: "REGISTRY_FAILED", httpStatus: 502 });
    await expect(lookupDomainAge("garbage.com")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
  });

  it("follows at most two redirects, only to named hosts on the default port", async () => {
    const base = "https://rdap.verisign.example/com/v1/domain/";
    routes[`${base}moved.com`] = [302, "", { location: "https://rdap2.example/domain/moved.com" }];
    routes["https://rdap2.example/domain/moved.com"] = [200, { ldhName: "moved.com" }];
    await expect(lookupDomainAge("moved.com")).resolves.toMatchObject({ domain: "moved.com" });

    routes[`${base}internal.com`] = [302, "", { location: "http://127.0.0.1/domain/internal.com" }];
    routes[`${base}port.com`] = [302, "", { location: "https://evil.example:8443/x" }];
    routes[`${base}loop.com`] = [302, "", { location: `${base}loop.com` }];
    for (const name of ["internal.com", "port.com", "loop.com"]) await expect(lookupDomainAge(name)).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
    expect(fetched()).not.toContain("http://127.0.0.1/domain/internal.com");
    expect(fetched().filter((u) => u.endsWith("loop.com"))).toHaveLength(3);
  });

  it("refuses oversized answers", async () => {
    routes["https://rdap.verisign.example/com/v1/domain/huge.com"] = [200, "x".repeat(600_000)];
    await expect(lookupDomainAge("huge.com")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
  });

  it("no IANA list (first start, network down) → REGISTRY_FAILED", async () => {
    routes["https://data.iana.org/rdap/dns.json"] = [503, {}];
    await expect(lookupDomainAge("google.com")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
  });

  it("TLDs without RDAP go to the WHOIS server IANA names for them", async () => {
    whois.answers.set("whois.iana.org", (q) => (q === "io" ? "domain: IO\nwhois: whois.nic.io\n" : "domain: XX\n"));
    whois.answers.set("whois.nic.io", (q) => (q === "github.io" ? "Domain Name: github.io\nCreation Date: 2013-03-08T21:59:34Z\nRegistrar: MarkMonitor Inc.\n" : 'No match for "X".'));
    await expect(lookupDomainAge("someone.github.io")).resolves.toMatchObject({ domain: "github.io", registered: "2013-03-08T21:59:34.000Z", source: "whois" });
    await expect(lookupDomainAge("nope-123.io")).rejects.toMatchObject({ code: "NOT_REGISTERED" });
    await expect(lookupDomainAge("example.xx")).rejects.toMatchObject({ code: "NO_REGISTRY_SERVICE", httpStatus: 422 });
    // IANA asked once per TLD.
    expect(whois.queries.filter((q) => q === "whois.iana.org io")).toHaveLength(1);
  });

  it("DENIC gets its '-T dn' query form; a refused WHOIS connection → REGISTRY_FAILED", async () => {
    whois.answers.set("whois.iana.org", (q) => `whois: whois.${q === "de" ? "denic.de" : "nic.me"}\n`);
    whois.answers.set("whois.denic.de", () => "Domain: example.de\nStatus: connect\n");
    await expect(lookupDomainAge("example.de")).resolves.toMatchObject({ registered: null });
    expect(whois.queries).toContain("whois.denic.de -T dn example.de");
    await expect(lookupDomainAge("example.me")).rejects.toMatchObject({ code: "REGISTRY_FAILED" });
  });
});
