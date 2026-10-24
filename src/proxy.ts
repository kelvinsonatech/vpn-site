import { NextResponse, type NextRequest } from "next/server";
import { adsenseClientId } from "@/lib/adsense";

/**
 * Edge of the app:
 *  0. One public address: pages requested on the "www." twin of APP_URL's host (or the bare host
 *     when APP_URL uses www.) are redirected to APP_URL's host, so browser storage (My accounts),
 *     Safari's per-site choices such as "Never for This Website" and search engines see one site.
 *  1. Content-Security-Policy with a per-request nonce for every page.
 *  2. Optimistic admin gate: requests to /admin/* without a session cookie go to the login page.
 *     Real authentication/authorization happens in the layouts, pages and actions (guards.ts).
 * Third parties: Cloudflare Turnstile when CAPTCHA_PROVIDER=turnstile, and Google AdSense on public
 * pages (never /admin) when ADSENSE_CLIENT_ID is set.
 */
const SESSION_COOKIES = ["__Host-vl_admin", "vl_admin"];
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function csp(nonce: string, ads: boolean) {
  const dev = process.env.NODE_ENV === "development";
  // Read directly (not via env()): the proxy must not need the database/Redis configuration.
  const turnstile = process.env.CAPTCHA_PROVIDER === "turnstile";
  const captcha = turnstile ? ` ${TURNSTILE_ORIGIN}` : "";
  // AdSense supports only a nonce-based strict policy and changes its hosts over time, so with ads its
  // frames, images and requests may use any https: origin (Google's documented policy also needs
  // 'unsafe-eval'); scripts still need the nonce or must be loaded by a nonced script.
  const evalSrc = dev || ads ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    // The hosts are a CSP2 fallback; CSP3 browsers rely on the nonce + 'strict-dynamic'.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${captcha}${ads ? " https:" : ""}${evalSrc}`,
    // Inline style attributes are used by UI primitives (positioning); scripts stay nonce-locked.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${ads ? " https:" : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${ads ? " https:" : captcha}`,
    ...(ads ? ["frame-src https:"] : turnstile ? [`frame-src ${TURNSTILE_ORIGIN}`] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!dev && process.env.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function canonicalHostRedirect(request: NextRequest): NextResponse | null {
  let app: URL;
  try {
    app = new URL(process.env.APP_URL ?? "");
  } catch {
    return null;
  }
  const canonical = app.hostname.toLowerCase();
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!host || host === canonical) return null;
  if (host !== `www.${canonical}` && `www.${host}` !== canonical) return null;
  return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, app.origin), 308);
}

export function proxy(request: NextRequest) {
  const redirect = canonicalHostRedirect(request);
  if (redirect) return redirect;

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const hasCookie = SESSION_COOKIES.some((n) => request.cookies.has(n));
    if (!hasCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce, adsenseClientId() !== null && !pathname.startsWith("/admin"));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
