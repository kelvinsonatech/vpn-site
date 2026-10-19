/**
 * "V2Ray to JSON": turns a share link (vmess://, vless://, trojan://, ss://) into a V2Ray/Xray client
 * config. Pure and browser-safe: the tool runs it on the visitor's device, so the link (which holds
 * the account's UUID or password) never reaches our server.
 *
 * Links follow the common formats: VMess as v2rayN's base64 JSON (or the newer URI form), VLESS and
 * Trojan as the Xray share-link URI, Shadowsocks as SIP002 (or the older all-base64 form).
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
  /** VMess encryption ("auto"...) or Shadowsocks method; VLESS flow. */
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
  const clean = s.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null;
  try {
    const bin = atob(clean.replace(/=+$/, "").padEnd(Math.ceil(clean.replace(/=+$/, "").length / 4) * 4, "="));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

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
  allowInsecure: boolean;
  publicKey: string | null;
  shortId: string | null;
  spiderX: string | null;
  seed: string | null;
  quicSecurity: string | null;
  quicKey: string | null;
  authority: string | null;
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

function streamSettings(s: Stream, address: string, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { network: s.network, security: s.security };
  const isDomain = !/^[\d.]+$/.test(address) && !address.includes(":");
  const serverName = s.sni || s.host || (isDomain ? address : null);
  if (s.security === "tls") {
    const tls: Record<string, unknown> = { allowInsecure: s.allowInsecure };
    if (serverName) tls.serverName = serverName;
    if (s.alpn.length) tls.alpn = s.alpn;
    if (s.fingerprint) tls.fingerprint = s.fingerprint;
    out.tlsSettings = tls;
    if (s.allowInsecure)
      warnings.push("The link turns off certificate checks (allowInsecure), so the config does too. Only keep that if you trust the server.");
  } else if (s.security === "reality") {
    const reality: Record<string, unknown> = { show: false, fingerprint: s.fingerprint || "chrome" };
    if (serverName) reality.serverName = serverName;
    if (s.publicKey) reality.publicKey = s.publicKey;
    else warnings.push("The link uses REALITY but has no public key (pbk), so it won't connect until you add one.");
    reality.shortId = s.shortId ?? "";
    if (s.spiderX) reality.spiderX = s.spiderX;
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
      if (s.mode) xh.mode = s.mode;
      out.xhttpSettings = xh;
      break;
    }
    case "kcp": {
      const kcp: Record<string, unknown> = { header: { type: s.headerType || "none" } };
      if (s.seed) kcp.seed = s.seed;
      out.kcpSettings = kcp;
      break;
    }
    case "quic":
      warnings.push(
        "The link uses the QUIC transport, which newer Xray versions no longer support. Use an app with an older core, or ask for another transport.",
      );
      out.quicSettings = { security: s.quicSecurity || "none", key: s.quicKey ?? "", header: { type: s.headerType || "none" } };
      break;
  }
  return out;
}

function securityOf(raw: string | null | undefined, fallback: "none" | "tls"): "none" | "tls" | "reality" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "tls" || v === "xtls") return "tls";
  if (v === "reality") return "reality";
  if (v === "none" || v === "") return v === "" ? fallback : "none";
  return fallback;
}

/** vless://, trojan:// and URI-form vmess:// links: credential@host:port?params#remark. */
function parseUriLink(scheme: "vmess" | "vless" | "trojan", raw: string, warnings: string[]) {
  const rest = raw.slice(scheme.length + 3);
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
  const security = securityOf(get("security"), scheme === "trojan" ? "tls" : "none");
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
    allowInsecure: truthy(get("allowInsecure")) || truthy(get("insecure")),
    publicKey: get("pbk") || null,
    shortId: get("sid"),
    spiderX: get("spx") || null,
    seed: get("seed") || null,
    quicSecurity: get("quicSecurity") || null,
    quicKey: get("key") || null,
    authority: get("authority") || null,
  };
  const encryption = get("encryption");
  if (scheme === "vless" && encryption && encryption !== "none") warnings.push(`The link asks for VLESS encryption "${encryption}"; it was kept as written.`);
  return {
    params: Object.fromEntries(p),
    remark: decode(url.hash.slice(1)),
    address: needHost(url.hostname),
    port: toPort(portOf(rest) || (scheme === "trojan" ? "443" : "")),
    secret,
    flow: get("flow") || null,
    method: scheme === "vmess" ? get("encryption") || "auto" : scheme === "vless" ? encryption || "none" : null,
    stream,
  };
}

/** v2rayN's vmess://base64(JSON). */
function parseVmessJson(json: Record<string, unknown>, warnings: string[]) {
  const str = (k: string) => (json[k] === undefined || json[k] === null ? "" : String(json[k]).trim());
  if (!str("id")) throw new LinkError("The vmess:// link has no user ID (id).");
  const net = network(str("net"), warnings);
  const security = str("tls") === "tls" ? "tls" : str("tls") === "reality" ? "reality" : "none";
  const aid = Number(str("aid") || 0);
  if (aid > 0) warnings.push(`The link sets alterId ${aid}. Newer servers expect 0 (VMess AEAD); keep it only if your server uses legacy VMess.`);
  return {
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
      host: str("host") || null,
      path: net === "grpc" ? str("path") : str("path") || null,
      headerType: str("type") && str("type") !== "none" && net !== "grpc" ? str("type") : null,
      mode: net === "grpc" ? (str("type") === "multi" ? "multi" : null) : str("mode") || null,
      alpn: list(str("alpn")),
      fingerprint: str("fp") || null,
      allowInsecure: str("allowInsecure") === "1" || str("allowInsecure") === "true",
      publicKey: str("pbk") || null,
      shortId: str("sid") || null,
      spiderX: str("spx") || null,
      seed: net === "kcp" ? str("path") || null : null,
      quicSecurity: net === "quic" ? str("host") || null : null,
      quicKey: net === "quic" ? str("path") || null : null,
      authority: null,
    } satisfies Stream,
  };
}

/** ss://base64(method:password)@host:port#tag (SIP002), ss://method:password@... (2022 keys), or ss://base64(method:password@host:port)#tag. */
function parseShadowsocks(raw: string, warnings: string[]) {
  const body = raw.slice("ss://".length);
  const hashAt = body.indexOf("#");
  const remark = hashAt >= 0 ? decode(body.slice(hashAt + 1)) : "";
  let main = hashAt >= 0 ? body.slice(0, hashAt) : body;
  if (!main.includes("@")) {
    // Legacy: everything before the tag is base64.
    const plain = fromBase64(main.split(/[/?]/)[0]!);
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
  const server = main.slice(at + 1);
  let url: URL;
  try {
    url = new URL(`http://${server}`);
  } catch {
    throw new LinkError("The ss:// link's server address isn't valid.");
  }
  if (url.searchParams.get("plugin")) {
    warnings.push(
      `The link uses the plugin "${url.searchParams.get("plugin")!.split(";")[0]}". V2Ray/Xray can't run Shadowsocks plugins, so the config leaves it out and may not connect.`,
    );
  }
  return { remark, address: needHost(url.hostname), port: toPort(portOf(server)), secret, method, plugin: url.searchParams.get("plugin") };
}

/** Decodes one share link and builds its JSON. Throws LinkError with a message for the visitor. */
export function convertLink(input: string): Conversion {
  const raw = input.trim();
  if (!raw) throw new LinkError("Paste a vmess://, vless://, trojan:// or ss:// link.");
  if (raw.length > MAX_LINK) throw new LinkError("That link is too long.");
  if (/\s/.test(raw)) throw new LinkError("Paste one link at a time (it has spaces or more than one line).");
  const scheme = /^([a-z0-9+.-]+):\/\//i.exec(raw)?.[1]?.toLowerCase();
  const warnings: string[] = [];

  let link: DecodedLink;
  let outbound: Record<string, unknown>;
  let decoded: Record<string, unknown>;

  if (scheme === "vmess") {
    const text = fromBase64(raw.slice("vmess://".length).split("#")[0]!);
    let parsed: (ReturnType<typeof parseVmessJson> & { alterId?: number }) | ReturnType<typeof parseUriLink>;
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {}
    }
    if (json && typeof json === "object" && !Array.isArray(json)) {
      parsed = parseVmessJson(json as Record<string, unknown>, warnings);
      decoded = json as Record<string, unknown>;
    } else if (raw.includes("@")) {
      const uri = parseUriLink("vmess", raw, warnings);
      parsed = uri;
      decoded = uriDecoded("vmess", uri, "id");
    } else throw new LinkError("That vmess:// link isn't in a format we can read.");
    const alterId = "alterId" in parsed ? (parsed.alterId ?? 0) : 0;
    outbound = {
      tag: "proxy",
      protocol: "vmess",
      settings: { vnext: [{ address: parsed.address, port: parsed.port, users: [{ id: parsed.secret, alterId, security: parsed.method ?? "auto" }] }] },
      streamSettings: streamSettings(parsed.stream, parsed.address, warnings),
    };
    link = summary("vmess", parsed);
  } else if (scheme === "vless" || scheme === "trojan") {
    const parsed = parseUriLink(scheme, raw, warnings);
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
function uriDecoded(
  protocol: string,
  p: { address: string; port: number; secret: string; remark: string; params: Record<string, string> },
  secretKey: "id" | "password",
) {
  return { protocol, address: p.address, port: p.port, [secretKey]: p.secret, ...p.params, remark: p.remark };
}

function summary(
  protocol: V2rayProtocol,
  p: { remark: string; address: string; port: number; secret: string; method: string | null; flow: string | null; stream: Stream },
): DecodedLink {
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
