import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * The edge proxy (src/proxy.ts): per-request CSP nonce, the Turnstile relaxation that only exists
 * while CAPTCHA_PROVIDER=turnstile, and the optimistic admin gate.
 */

function run(path: string, init?: { cookie?: string }) {
  const headers = new Headers();
  if (init?.cookie) headers.set("cookie", init.cookie);
  return proxy(new NextRequest(new URL(path, "http://localhost:3000"), { headers }));
}

/** Directive name -> its source list. */
function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((d) => {
      const [name, ...sources] = d.trim().split(/\s+/);
      return [name!, sources];
    }),
  );
}

describe("proxy: Content-Security-Policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("locks scripts to a fresh nonce and allows no third party by default", () => {
    vi.stubEnv("CAPTCHA_PROVIDER", "none");
    const a = run("/");
    const b = run("/ssh");
    const policy = a.headers.get("content-security-policy")!;
    const csp = directives(policy);
    const nonce = a.headers.get("x-middleware-request-x-nonce");
    expect(nonce).toBeTruthy();
    // The page receives the same nonce and policy through the forwarded request headers.
    expect(a.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(csp.get("script-src")).toEqual(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]);
    expect(b.headers.get("x-middleware-request-x-nonce")).not.toBe(nonce);
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("connect-src")).toEqual(["'self'"]);
    expect(csp.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(csp.get("font-src")).toEqual(["'self'", "data:"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.has("frame-src")).toBe(false);
    expect(policy).not.toContain("cloudflare");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("adds Cloudflare Turnstile (script, XHR, frame) only when the captcha is enabled", () => {
    vi.stubEnv("CAPTCHA_PROVIDER", "turnstile");
    const csp = directives(run("/report").headers.get("content-security-policy")!);
    const origin = "https://challenges.cloudflare.com";
    expect(csp.get("script-src")).toContain(origin);
    expect(csp.get("connect-src")).toEqual(["'self'", origin]);
    expect(csp.get("frame-src")).toEqual([origin]);
    // Nothing else is relaxed.
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
  });

  it("opens what Google AdSense needs on public pages only, and only when ADSENSE_CLIENT_ID is set", () => {
    vi.stubEnv("CAPTCHA_PROVIDER", "turnstile");
    vi.stubEnv("ADSENSE_CLIENT_ID", "ca-pub-1234567890123456");
    const pub = directives(run("/guides").headers.get("content-security-policy")!);
    const nonceOf = (s: string[]) => s.find((x) => x.startsWith("'nonce-"));
    // Scripts still need the nonce (or a nonced loader, 'strict-dynamic'); the rest follows Google's strict-CSP guidance.
    expect(nonceOf(pub.get("script-src")!)).toBeTruthy();
    expect(pub.get("script-src")).toEqual(expect.arrayContaining(["'strict-dynamic'", "https:", "'unsafe-eval'"]));
    expect(pub.get("frame-src")).toEqual(["https:"]);
    expect(pub.get("img-src")).toEqual(["'self'", "data:", "blob:", "https:"]);
    expect(pub.get("connect-src")).toEqual(["'self'", "https:"]);
    expect(pub.get("object-src")).toEqual(["'none'"]);
    expect(pub.get("frame-ancestors")).toEqual(["'none'"]);

    // The admin panel keeps the strict policy (only the captcha, as before).
    const admin = directives(run("/admin/login").headers.get("content-security-policy")!);
    expect(admin.get("script-src")).not.toContain("'unsafe-eval'");
    expect(admin.get("script-src")).not.toContain("https:");
    expect(admin.get("frame-src")).toEqual(["https://challenges.cloudflare.com"]);
    expect(admin.get("img-src")).toEqual(["'self'", "data:", "blob:"]);

    // A malformed ID turns ads off rather than relaxing anything.
    vi.stubEnv("ADSENSE_CLIENT_ID", "pub-123");
    expect(run("/").headers.get("content-security-policy")).not.toContain("unsafe-eval");
  });

  it("upgrades insecure requests only for an https APP_URL outside development", () => {
    vi.stubEnv("APP_URL", "https://vpn.example.com");
    expect(run("/").headers.get("content-security-policy")).toContain("upgrade-insecure-requests");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(run("/").headers.get("content-security-policy")).not.toContain("upgrade-insecure-requests");
  });
});

describe("proxy: admin gate", () => {
  it("sends admin pages without a session cookie to the login page", () => {
    const res = run("/admin/servers?tab=x");
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/login");
    expect(new URL(res.headers.get("location")!).search).toBe("");
  });

  it("lets the login page and cookie-bearing requests through (real checks happen server side)", () => {
    expect(run("/admin/login").headers.get("location")).toBeNull();
    expect(run("/admin", { cookie: "vl_admin=abc" }).headers.get("location")).toBeNull();
    expect(run("/admin", { cookie: "__Host-vl_admin=abc" }).headers.get("location")).toBeNull();
    expect(run("/admin", { cookie: "other=abc" }).status).toBe(307);
  });
});

describe("proxy: one public address", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const at = (url: string) => {
    const u = new URL(url);
    return proxy(new NextRequest(u, { headers: new Headers({ host: u.host }) }));
  };

  it("sends the www. twin to APP_URL's host, keeping path and query", () => {
    vi.stubEnv("APP_URL", "https://litronssh.com");
    const res = at("https://www.litronssh.com/ssh/canada/ca1?x=1");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://litronssh.com/ssh/canada/ca1?x=1");
  });

  it("works the other way round when APP_URL uses www.", () => {
    vi.stubEnv("APP_URL", "https://www.example.com");
    expect(at("https://example.com/").headers.get("location")).toBe("https://www.example.com/");
  });

  it("leaves the canonical host and unrelated hosts alone", () => {
    vi.stubEnv("APP_URL", "https://litronssh.com");
    for (const url of ["https://litronssh.com/", "https://other.example/", "http://localhost:3000/"]) {
      const res = at(url);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("content-security-policy")).toBeTruthy();
    }
  });

  it("does nothing without a valid APP_URL", () => {
    vi.stubEnv("APP_URL", "");
    expect(at("https://www.litronssh.com/").headers.get("location")).toBeNull();
  });
});
