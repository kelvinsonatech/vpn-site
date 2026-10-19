/**
 * "V2Ray to JSON": turns a share link (vmess://, vless://, trojan://, ss://) into a V2Ray/Xray client
 * config. Pure and browser-safe: the tool runs it on the visitor's device, so the link (which holds
 * the account's UUID or password) never reaches our server.
 *
 * Links follow the common formats: VMess as v2rayN's base64 JSON (or the URI form, or Shadowrocket's
 * base64 user info), VLESS and Trojan as the Xray share-link URI, Shadowsocks as SIP002 (or the older
 * all-base64 form). The config targets current Xray: settings it has removed (allowInsecure, the old
 * mKCP header/seed, HTTP/2 and QUIC transports, XTLS flows, stream ciphers) are left out or flagged.
 */

export type V2rayProtocol = "vmess" | "vless" | "trojan" | "shadowsocks";

/** The link's settings in plain words, for the summary next to the JSON. */
export interface DecodedLink {
  protocol: V2rayProtocol;
  remark: string;
  address: string;
  port: number;
  /** UUID (VMess/VLESS) or password (Trojan/Shadowsocks). */
  secret: string;
  /** VMess encryption ("auto"...) or Shadowsocks method; VLESS encryption. */
  method: string | null;
  flow: string | null;
  network: string;
  security: "none" | "tls" | "reality";
  sni: string | null;
  host: string | null;
  /** Path, or the gRPC service name. */
  path: string | null;
}

export interface Conversion {
  link: DecodedLink;
  /**
   * The link itself as JSON: for v2rayN-style VMess, its JSON exactly as encoded (key order kept); for
   * other links, the parts of the URI (address, port, credential, every query parameter, remark).
   */
  decoded: Record<string, unknown>;
  /** The proxy outbound alone, to paste into an existing config. */
  outbound: Record<string, unknown>;
  /** A complete client config: local SOCKS 10808 and HTTP 10809 proxies, the link as the default outbound. */
  config: Record<string, unknown>;
  /** Things in the link the JSON can't carry or the reader should know. */
  warnings: string[];
}

export class LinkError extends Error {}

const MAX_LINK = 8192;

/** base64 or base64url, with or without padding or line breaks, to UTF-8 text; null when it isn't base64. */
function fromBase64(s: string): string | null {
  const clean = s.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!clean || !/^[A-Za-z0-9+/]+$/.test(clean)) return null;
  try {
    const bin = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, "="));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Percent-decodes each run of valid %XX escapes and leaves a stray "%" alone ("100%Speed" stays). */
const decode = (s: string) =>
  s.replace(/(?:%[0-9A-Fa-f]{2})+/g, (m) => {
    try {
      return decodeURIComponent(m);
    } catch {
      return m;
    }
  });

function toPort(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new LinkError("The link's port is missing or isn't a number between 1 and 65535.");
  return n;
}

function needHost(h: string): string {
  const host = h.replace(/^\[|\]$/g, "").trim();
  if (!host) throw new LinkError("The link has no server address.");
  return host;
}

const list = (v: string | null | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const truthy = (v: string | null | undefined) => v === "1" || v === "true";

/**
 * The port as written in "cred@host:port/...": read from the text because URL drops a scheme's default
 * port (we parse with http://, so ":80" would vanish).
 */
function portOf(rest: string): string {
  const authority = rest.split(/[/?#]/)[0]!;
  const hostport = authority.slice(authority.lastIndexOf("@") + 1);
  return (hostport.startsWith("[") ? /\]:(\d+)$/.exec(hostport) : /:(\d+)$/.exec(hostport))?.[1] ?? "";
}

/** Spaces typed into a URI link (usually in the remark) are percent-encoded, as v2rayNG does. */
const fixSpaces = (s: string) => s.replace(/[ \t]/g, "%20");

/** Transport and security, the part every link type shares. */
interface Stream {
  network: string;
  security: "none" | "tls" | "reality";
  sni: string | null;
  host: string | null;
  path: string | null;
  headerType: string | null;
  /** gRPC "multi" mode, xhttp mode... */
  mode: string | null;
  alpn: string[];
  fingerprint: string | null;
  /** The link asks to skip certificate checks (current Xray has no such setting). */
  insecure: boolean;
  /** Certificate pinning that replaced allowInsecure: SHA-256 of the server certificate, or the name to check. */
  pinnedPeerCertSha256: string | null;
  verifyPeerCertByName: string | null;
  echConfigList: string | null;
  publicKey: string | null;
  shortId: string | null;
  spiderX: string | null;
  mldsa65Verify: string | null;
  seed: string | null;
  quicSecurity: string | null;
  quicKey: string | null;
  authority: string | null;
  /** XHTTP "extra" (JSON text). */
  extra: string | null;
  /** Finalmask (JSON text), from v2rayN's "fm". */
  finalmask: string | null;
}

const NETWORKS: Record<string, string> = {
  tcp: "tcp",
  raw: "tcp",
  ws: "ws",
  websocket: "ws",
  grpc: "grpc",
  gun: "grpc",
  h2: "h2",
  http: "h2",
  httpupgrade: "httpupgrade",
  xhttp: "xhttp",
  splithttp: "xhttp",
  kcp: "kcp",
  mkcp: "kcp",
  quic: "quic",
};

function network(raw: string | null | undefined, warnings: string[]): string {
  const key = (raw || "tcp").trim().toLowerCase();
  const net = NETWORKS[key];
  if (!net) {
    warnings.push(`The link uses the "${key}" transport, which this converter doesn't know; it was set as written.`);
    return key;
  }
  return net;
}

const XHTTP_MODES = new Set(["auto", "packet-up", "stream-up", "stream-one"]);
/** Old mKCP header names → current Xray's finalmask names. */
const KCP_HEADERS: Record<string, string> = {
  srtp: "srtp",
  utp: "utp",
  "wechat-video": "wechat",
  wechat: "wechat",
  dtls: "dtls",
  wireguard: "wireguard",
  dns: "dns",
};

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function streamSettings(s: Stream, address: string, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { network: s.network, security: s.security };
  const isDomain = !/^[\d.]+$/.test(address) && !address.includes(":");
  const serverName = s.sni || list(s.host)[0] || (isDomain ? address : null);
  if (s.security === "tls") {
    const tls: Record<string, unknown> = {};
    if (serverName) tls.serverName = serverName;
    if (s.alpn.length) tls.alpn = s.alpn;
    if (s.fingerprint) tls.fingerprint = s.fingerprint;
    if (s.pinnedPeerCertSha256) tls.pinnedPeerCertSha256 = s.pinnedPeerCertSha256;
    if (s.verifyPeerCertByName) tls.verifyPeerCertByName = s.verifyPeerCertByName;
    if (s.echConfigList) tls.echConfigList = s.echConfigList;
    out.tlsSettings = tls;
    if (s.insecure && !s.pinnedPeerCertSha256 && !s.verifyPeerCertByName) {
      warnings.push(
        "The link turns off certificate checks (allowInsecure). Current Xray refuses that setting, so it was left out: the config checks the server's certificate and won't connect to a self-signed server. Ask for the certificate's SHA-256 (pinnedPeerCertSha256) to pin it instead.",
      );
    }
  } else if (s.security === "reality") {
    const reality: Record<string, unknown> = { show: false, fingerprint: s.fingerprint || "chrome" };
    if (serverName) reality.serverName = serverName;
    if (s.publicKey) reality.publicKey = s.publicKey;
    else warnings.push("The link uses REALITY but has no public key (pbk), so it won't connect until you add one.");
    reality.shortId = s.shortId ?? "";
    if (s.spiderX) reality.spiderX = s.spiderX;
    if (s.mldsa65Verify) reality.mldsa65Verify = s.mldsa65Verify;
    out.realitySettings = reality;
  }
  switch (s.network) {
    case "tcp":
      if (s.headerType === "http") {
        out.tcpSettings = {
          header: {
            type: "http",
            request: { path: list(s.path).length ? list(s.path) : ["/"], headers: s.host ? { Host: list(s.host) } : {} },
          },
        };
      }
      break;
    case "ws": {
      const ws: Record<string, unknown> = { path: s.path || "/" };
      if (s.host) ws.headers = { Host: s.host };
      out.wsSettings = ws;
      break;
    }
    case "grpc": {
      const grpc: Record<string, unknown> = { serviceName: s.path ?? "", multiMode: s.mode === "multi" };
      if (s.authority) grpc.authority = s.authority;
      out.grpcSettings = grpc;
      break;
    }
    case "h2": {
      warnings.push(
        "The link uses the HTTP/2 (h2) transport, which current Xray has removed, so it will refuse this config. Use an app with an older core, or ask the provider for an XHTTP, WebSocket or gRPC link.",
      );
      const h2: Record<string, unknown> = { path: s.path || "/" };
      if (s.host) h2.host = list(s.host);
      out.httpSettings = h2;
      break;
    }
    case "httpupgrade": {
      const hu: Record<string, unknown> = { path: s.path || "/" };
      if (s.host) hu.host = s.host;
      out.httpupgradeSettings = hu;
      break;
    }
    case "xhttp": {
      const xh: Record<string, unknown> = { path: s.path || "/" };
      if (s.host) xh.host = s.host;
      if (s.mode && XHTTP_MODES.has(s.mode)) xh.mode = s.mode;
      else if (s.mode) warnings.push(`The link asks for XHTTP mode "${s.mode}", which Xray doesn't have, so it was left out ("auto" is used).`);
      if (s.extra) {
        const extra = parseJsonObject(s.extra);
        if (extra) xh.extra = extra;
        else warnings.push("The link's XHTTP extra settings couldn't be read, so they were left out.");
      }
      out.xhttpSettings = xh;
      break;
    }
    case "kcp": {
      // Current Xray moved the mKCP header and seed to finalmask ("mkcp-legacy" masks, Xray 26.6.1+), as v2rayN writes them.
      out.kcpSettings = {};
      if (!s.finalmask) {
        const masks: Record<string, unknown>[] = [s.seed ? { type: "mkcp-legacy", settings: { value: s.seed } } : { type: "mkcp-legacy" }];
        const header = (s.headerType ?? "none").toLowerCase();
        if (header !== "none") masks.push({ type: "mkcp-legacy", settings: { header: KCP_HEADERS[header] ?? header } });
        out.finalmask = { udp: masks };
      }
      warnings.push("The mKCP settings use Xray's newer finalmask form, which needs Xray 26.6.1 or newer. Older apps won't load this config.");
      break;
    }
    case "quic":
      warnings.push(
        "The link uses the QUIC transport, which current Xray has removed, so it will refuse this config. Use an app with an older core, or ask the provider for another transport.",
      );
      out.quicSettings = { security: s.quicSecurity || "none", key: s.quicKey ?? "", header: { type: s.headerType || "none" } };
      break;
  }
  if (s.finalmask) {
    const fm = parseJsonObject(s.finalmask);
    if (fm) out.finalmask = fm;
    else warnings.push("The link's finalmask (fm) settings couldn't be read, so they were left out.");
  }
  return out;
}

function securityOf(raw: string | null | undefined, fallback: "none" | "tls", warnings: string[]): "none" | "tls" | "reality" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "xtls") {
    warnings.push("The link uses legacy XTLS security, which Xray removed in 1.8. The config uses plain TLS; the server must support it (or Vision).");
    return "tls";
  }
  if (v === "tls") return "tls";
  if (v === "reality") return "reality";
  if (v === "none") return "none";
  return fallback;
}

const FLOWS = new Set(["xtls-rprx-vision", "xtls-rprx-vision-udp443"]);

/** The VLESS flow to write: Vision as given; the old XTLS flows (gone from Xray) are dropped with a note. */
function vlessFlow(flow: string | null, warnings: string[]): string | null {
  if (!flow) return null;
  if (FLOWS.has(flow)) return flow;
  warnings.push(
    `The link uses the flow "${flow}", which current Xray no longer has (only xtls-rprx-vision), so it was left out. The server needs to use Vision.`,
  );
  return null;
}

type Parsed = {
  params: Record<string, string>;
  remark: string;
  address: string;
  port: number;
  secret: string;
  flow: string | null;
  method: string | null;
  alterId?: number;
  stream: Stream;
};

/** vless://, trojan:// and URI-form vmess:// links: credential@host:port?params#remark. */
function parseUriLink(scheme: "vmess" | "vless" | "trojan", raw: string, warnings: string[]): Parsed {
  const rest = fixSpaces(raw.slice(scheme.length + 3));
  let url: URL;
  try {
    // Older browsers don't parse the host of a custom scheme; http:// gives a real one.
    url = new URL(`http://${rest}`);
  } catch {
    throw new LinkError(`That ${scheme}:// link isn't in a format we can read.`);
  }
  // A password with an unencoded ":" lands partly in url.password.
  const secret = decode(url.username) + (url.password ? `:${decode(url.password)}` : "");
  if (!secret) throw new LinkError(`The ${scheme}:// link has no ${scheme === "trojan" ? "password" : "user ID"} before the "@".`);
  const p = url.searchParams;
  const get = (k: string) => p.get(k);
  const security = securityOf(get("security"), scheme === "trojan" ? "tls" : "none", warnings);
  const net = network(get("type"), warnings);
  const stream: Stream = {
    network: net,
    security,
    sni: get("sni") || get("peer") || null,
    host: get("host") || null,
    path: net === "grpc" ? get("serviceName") || get("path") || "" : get("path") || null,
    headerType: get("headerType") || null,
    mode: get("mode") || null,
    alpn: list(get("alpn")),
    fingerprint: get("fp") || null,
    insecure: truthy(get("allowInsecure")) || truthy(get("insecure")) || truthy(get("allow_insecure")),
    pinnedPeerCertSha256: get("pcs") || null,
    verifyPeerCertByName: get("vcn") || null,
    echConfigList: get("ech") || null,
    publicKey: get("pbk") || null,
    shortId: get("sid"),
    spiderX: get("spx") || null,
    mldsa65Verify: get("pqv") || null,
    seed: get("seed") || null,
    quicSecurity: get("quicSecurity") || null,
    quicKey: get("key") || null,
    authority: get("authority") || null,
    extra: get("extra") || null,
    finalmask: get("fm") || null,
  };
  const encryption = get("encryption");
  if (scheme === "trojan" && get("flow")) warnings.push(`Trojan has no flows in current Xray, so the link's flow "${get("flow")}" was left out.`);
  return {
    params: Object.fromEntries(p),
    remark: decode(url.hash.slice(1)),
    address: needHost(url.hostname),
    port: toPort(portOf(rest) || (scheme === "trojan" ? "443" : "")),
    secret,
    flow: scheme === "vless" ? vlessFlow(get("flow") || null, warnings) : null,
    method: scheme === "vmess" ? get("encryption") || "auto" : scheme === "vless" ? encryption || "none" : null,
    stream,
  };
}

/**
 * Shadowrocket's form: vmess://base64(cipher:uuid@host:port)?remarks=…&obfs=websocket&obfsParam=…&path=…&tls=1&peer=…
 * (vless:// the same, with xtls=2 for Vision and pbk/sid for REALITY). Null when the link isn't one.
 */
function parseRocket(scheme: "vmess" | "vless", raw: string, warnings: string[]): Parsed | null {
  const body = raw.slice(scheme.length + 3);
  const hashAt = body.indexOf("#");
  const main = hashAt >= 0 ? body.slice(0, hashAt) : body;
  const q = main.indexOf("?");
  const text = fromBase64(q >= 0 ? main.slice(0, q) : main);
  const m = text ? /^([^:@]+):(.+)@(\[[^\]]+\]|[^:@\]]+):(\d+)$/.exec(text) : null;
  if (!m) return null;
  const p = new URLSearchParams(q >= 0 ? fixSpaces(main.slice(q + 1)) : "");
  const get = (k: string) => p.get(k);
  const obfs = (get("obfs") || get("network") || "").toLowerCase();
  const net = obfs === "websocket" || obfs === "ws" ? "ws" : obfs === "h2" ? "h2" : obfs === "grpc" ? "grpc" : "tcp";
  let host = get("obfsParam") || get("wsHost") || null;
  if (host?.startsWith("{")) {
    const h = parseJsonObject(host);
    host = typeof h?.Host === "string" ? h.Host : null;
  }
  const xtls = get("xtls");
  const alterId = Number(get("alterId") || get("aid") || 0);
  const security = get("pbk") ? "reality" : truthy(get("tls")) ? "tls" : "none";
  return {
    params: Object.fromEntries(p),
    remark: get("remarks") || decode(hashAt >= 0 ? body.slice(hashAt + 1) : ""),
    address: needHost(m[3]!),
    port: toPort(m[4]),
    secret: m[2]!,
    flow: scheme === "vless" ? vlessFlow(xtls === "2" ? "xtls-rprx-vision" : xtls === "1" ? "xtls-rprx-direct" : null, warnings) : null,
    method: scheme === "vmess" ? m[1]! : "none",
    alterId: Number.isInteger(alterId) && alterId >= 0 ? alterId : 0,
    stream: {
      network: net,
      security,
      sni: get("peer") || get("sni") || null,
      host,
      path: get("path") || get("wspath") || (net === "grpc" ? "" : null),
      headerType: obfs === "http" ? "http" : null,
      mode: null,
      alpn: list(get("alpn")),
      fingerprint: get("fp") || null,
      insecure: truthy(get("allowInsecure")) || truthy(get("insecure")),
      pinnedPeerCertSha256: null,
      verifyPeerCertByName: null,
      echConfigList: null,
      publicKey: get("pbk") || null,
      shortId: get("sid"),
      spiderX: get("spx") || null,
      mldsa65Verify: null,
      seed: null,
      quicSecurity: null,
      quicKey: null,
      authority: null,
      extra: null,
      finalmask: null,
    },
  };
}

/** v2rayN's vmess://base64(JSON). `type` and `host` mean different things per transport, as in v2rayN. */
function parseVmessJson(json: Record<string, unknown>, warnings: string[]): Parsed {
  const str = (k: string) => (json[k] === undefined || json[k] === null ? "" : String(json[k]).trim());
  if (!str("id")) throw new LinkError("The vmess:// link has no user ID (id).");
  const net = network(str("net"), warnings);
  const tls = str("tls").toLowerCase();
  const security = tls === "tls" ? "tls" : tls === "reality" ? "reality" : "none";
  const aid = Number(str("aid") || 0);
  if (aid > 0) warnings.push(`The link sets alterId ${aid}. Newer servers expect 0 (VMess AEAD); keep it only if your server uses legacy VMess.`);
  const type = str("type");
  return {
    params: {},
    remark: str("ps"),
    address: needHost(str("add")),
    port: toPort(str("port")),
    secret: str("id"),
    flow: null,
    method: str("scy") || "auto",
    alterId: Number.isInteger(aid) && aid >= 0 ? aid : 0,
    stream: {
      network: net,
      security,
      sni: str("sni") || null,
      // QUIC keeps its security in "host", which is no hostname.
      host: net === "quic" ? null : str("host") || null,
      path: net === "grpc" ? str("path") : str("path") || null,
      headerType: type && type !== "none" && net !== "grpc" && net !== "xhttp" ? type : null,
      mode: net === "grpc" ? (type === "multi" ? "multi" : null) : net === "xhttp" ? (XHTTP_MODES.has(type) ? type : str("mode") || null) : str("mode") || null,
      alpn: list(str("alpn")),
      fingerprint: str("fp") || null,
      insecure: truthy(str("insecure")) || truthy(str("allowInsecure")),
      pinnedPeerCertSha256: str("pcs") || null,
      verifyPeerCertByName: str("vcn") || null,
      echConfigList: str("ech") || null,
      publicKey: str("pbk") || null,
      shortId: str("sid") || null,
      spiderX: str("spx") || null,
      mldsa65Verify: str("pqv") || null,
      seed: net === "kcp" ? str("path") || null : null,
      quicSecurity: net === "quic" ? str("host") || null : null,
      quicKey: net === "quic" ? str("path") || null : null,
      authority: net === "grpc" ? str("authority") || str("host") || null : null,
      extra: str("extra") || null,
      finalmask: str("fm") || null,
    },
  };
}

/** Shadowsocks ciphers current Xray can use (AEAD and 2022); the old stream ciphers are gone. */
const SS_METHODS = new Set([
  "aes-128-gcm",
  "aes-256-gcm",
  "chacha20-poly1305",
  "chacha20-ietf-poly1305",
  "xchacha20-poly1305",
  "xchacha20-ietf-poly1305",
  "aead_aes_128_gcm",
  "aead_aes_256_gcm",
  "aead_chacha20_poly1305",
  "aead_xchacha20_poly1305",
  "2022-blake3-aes-128-gcm",
  "2022-blake3-aes-256-gcm",
  "2022-blake3-chacha20-poly1305",
]);

/** ss://base64(method:password)@host:port#tag (SIP002), ss://method:password@... (2022 keys), or ss://base64(method:password@host:port)#tag. */
function parseShadowsocks(raw: string, warnings: string[]) {
  const body = raw.slice("ss://".length);
  const hashAt = body.indexOf("#");
  const remark = hashAt >= 0 ? decode(body.slice(hashAt + 1)) : "";
  let main = hashAt >= 0 ? body.slice(0, hashAt) : body;
  if (!main.includes("@")) {
    // Legacy: everything before the tag is base64 (which may itself contain "/"), then perhaps "/?plugin=…".
    const plain = fromBase64(main.replace(/\?.*$/, "").replace(/\/+$/, ""));
    if (!plain || !plain.includes("@")) throw new LinkError("That ss:// link isn't in a format we can read.");
    main = plain;
  }
  const at = main.lastIndexOf("@");
  let userinfo = decode(main.slice(0, at));
  if (!userinfo.includes(":")) userinfo = fromBase64(userinfo) ?? "";
  const colon = userinfo.indexOf(":");
  if (colon <= 0) throw new LinkError("The ss:// link has no method and password.");
  const method = userinfo.slice(0, colon).toLowerCase();
  const secret = userinfo.slice(colon + 1);
  const server = fixSpaces(main.slice(at + 1));
  let url: URL;
  try {
    url = new URL(`http://${server}`);
  } catch {
    throw new LinkError("The ss:// link's server address isn't valid.");
  }
  if (!SS_METHODS.has(method)) {
    warnings.push(
      `The link uses the cipher "${method}". Current Xray only supports AEAD (…-gcm, …-poly1305) and 2022-blake3 ciphers, so it won't load this config.`,
    );
  }
  const plugin = url.searchParams.get("plugin");
  if (plugin) {
    warnings.push(
      `The link uses the plugin "${plugin.split(";")[0]}". V2Ray/Xray can't run Shadowsocks plugins, so the config leaves it out and may not connect.`,
    );
  }
  return { remark, address: needHost(url.hostname), port: toPort(portOf(server)), secret, method, plugin };
}

/** Decodes one share link and builds its JSON. Throws LinkError with a message for the visitor. */
export function convertLink(input: string): Conversion {
  // Line breaks (a wrapped base64 link) are dropped; other spaces are handled per link type.
  const raw = input.trim().replace(/[\r\n]+/g, "");
  if (!raw) throw new LinkError("Paste a vmess://, vless://, trojan:// or ss:// link.");
  if (raw.length > MAX_LINK) throw new LinkError("That link is too long.");
  if (input.split(/\s+/).filter((t) => /^[a-z][a-z0-9+.-]*:\/\//i.test(t)).length > 1) throw new LinkError("Paste one link at a time.");
  const scheme = /^([a-z0-9+.-]+):\/\//i.exec(raw)?.[1]?.toLowerCase();
  const warnings: string[] = [];

  let link: DecodedLink;
  let outbound: Record<string, unknown>;
  let decoded: Record<string, unknown>;

  if (scheme === "vmess") {
    const text = fromBase64(raw.slice("vmess://".length).split("#")[0]!);
    const json = text ? parseJsonObject(text) : null;
    let parsed: Parsed;
    if (json) {
      parsed = parseVmessJson(json, warnings);
      decoded = json;
    } else {
      const rocket = parseRocket("vmess", raw, warnings);
      if (rocket) {
        parsed = rocket;
        decoded = uriDecoded("vmess", rocket, "id");
      } else if (raw.includes("@")) {
        parsed = parseUriLink("vmess", raw, warnings);
        decoded = uriDecoded("vmess", parsed, "id");
      } else throw new LinkError("That vmess:// link isn't in a format we can read.");
    }
    outbound = {
      tag: "proxy",
      protocol: "vmess",
      settings: {
        vnext: [
          { address: parsed.address, port: parsed.port, users: [{ id: parsed.secret, alterId: parsed.alterId ?? 0, security: parsed.method ?? "auto" }] },
        ],
      },
      streamSettings: streamSettings(parsed.stream, parsed.address, warnings),
    };
    link = summary("vmess", parsed);
  } else if (scheme === "vless" || scheme === "trojan") {
    const parsed = (scheme === "vless" ? parseRocket("vless", raw, warnings) : null) ?? parseUriLink(scheme, raw, warnings);
    decoded = uriDecoded(scheme, parsed, scheme === "vless" ? "id" : "password");
    const user: Record<string, unknown> = scheme === "vless" ? { id: parsed.secret, encryption: parsed.method ?? "none" } : {};
    if (scheme === "vless" && parsed.flow) user.flow = parsed.flow;
    outbound = {
      tag: "proxy",
      protocol: scheme,
      settings:
        scheme === "vless"
          ? { vnext: [{ address: parsed.address, port: parsed.port, users: [user] }] }
          : { servers: [{ address: parsed.address, port: parsed.port, password: parsed.secret }] },
      streamSettings: streamSettings(parsed.stream, parsed.address, warnings),
    };
    if (scheme === "vless" && parsed.stream.security === "none" && (parsed.method ?? "none") === "none") {
      warnings.push(
        "This VLESS link has no TLS, REALITY or VLESS encryption. The newest Xray versions refuse that for servers on the internet, so it may only work in older apps.",
      );
    }
    link = summary(scheme, parsed);
  } else if (scheme === "ss") {
    const parsed = parseShadowsocks(raw, warnings);
    decoded = {
      protocol: "shadowsocks",
      address: parsed.address,
      port: parsed.port,
      method: parsed.method,
      password: parsed.secret,
      ...(parsed.plugin ? { plugin: parsed.plugin } : {}),
      remark: parsed.remark,
    };
    outbound = {
      tag: "proxy",
      protocol: "shadowsocks",
      settings: { servers: [{ address: parsed.address, port: parsed.port, method: parsed.method, password: parsed.secret }] },
      streamSettings: { network: "tcp" },
    };
    link = {
      protocol: "shadowsocks",
      remark: parsed.remark,
      address: parsed.address,
      port: parsed.port,
      secret: parsed.secret,
      method: parsed.method,
      flow: null,
      network: "tcp",
      security: "none",
      sni: null,
      host: null,
      path: null,
    };
  } else if (scheme === "hysteria2" || scheme === "hy2" || scheme === "hysteria" || scheme === "tuic") {
    throw new LinkError("That's a Hysteria/TUIC link, not a V2Ray one. Import it into an app that supports it (such as NekoBox or Hiddify) instead.");
  } else if (scheme === "ssh" || scheme === "ssr") {
    throw new LinkError(`${scheme.toUpperCase()} links can't be turned into a V2Ray config. Paste a vmess://, vless://, trojan:// or ss:// link.`);
  } else {
    throw new LinkError("That isn't a V2Ray link. It should start with vmess://, vless://, trojan:// or ss://.");
  }

  const config: Record<string, unknown> = {
    ...(link.remark ? { remarks: link.remark } : {}),
    log: { loglevel: "warning" },
    dns: { servers: ["1.1.1.1", "8.8.8.8"] },
    inbounds: [
      {
        tag: "socks",
        port: 10808,
        listen: "127.0.0.1",
        protocol: "socks",
        settings: { auth: "noauth", udp: true },
        sniffing: { enabled: true, destOverride: ["http", "tls"] },
      },
      { tag: "http", port: 10809, listen: "127.0.0.1", protocol: "http", settings: {} },
    ],
    outbounds: [outbound, { tag: "direct", protocol: "freedom", settings: {} }, { tag: "block", protocol: "blackhole", settings: {} }],
    routing: { domainStrategy: "AsIs", rules: [{ type: "field", ip: ["geoip:private"], outboundTag: "direct" }] },
  };
  return { link, decoded, outbound, config, warnings };
}

/** A URI link's parts as JSON, in reading order: protocol, server, credential, its parameters, remark. */
function uriDecoded(protocol: string, p: Parsed, secretKey: "id" | "password") {
  return { protocol, address: p.address, port: p.port, [secretKey]: p.secret, ...p.params, remark: p.remark };
}

function summary(protocol: V2rayProtocol, p: Parsed): DecodedLink {
  return {
    protocol,
    remark: p.remark,
    address: p.address,
    port: p.port,
    secret: p.secret,
    method: p.method,
    flow: p.flow,
    network: p.stream.network,
    security: p.stream.security,
    sni: p.stream.sni,
    host: p.stream.host,
    path: p.stream.path,
  };
}
