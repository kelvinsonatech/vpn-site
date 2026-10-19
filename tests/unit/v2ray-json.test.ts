import { describe, expect, it } from "vitest";
import { convertLink, LinkError } from "@/lib/v2ray-json";

const UUID = "b831381d-6324-4d53-ad4f-8cda48b30811";
const b64 = (s: string) => Buffer.from(s).toString("base64");
const b64url = (s: string) => Buffer.from(s).toString("base64url");
const vmess = (o: Record<string, unknown>) => `vmess://${b64(JSON.stringify(o))}`;
const fails = (link: string, message: RegExp) => {
  expect(() => convertLink(link)).toThrow(LinkError);
  expect(() => convertLink(link)).toThrow(message);
};

describe("V2Ray to JSON", () => {
  it("VMess (v2rayN JSON): WebSocket over TLS, UTF-8 remark", () => {
    const r = convertLink(
      vmess({
        v: "2",
        ps: "Germany 01 🇩🇪",
        add: "de1.example.com",
        port: "443",
        id: UUID,
        aid: "0",
        scy: "auto",
        net: "ws",
        type: "none",
        host: "cdn.example.com",
        path: "/vmess",
        tls: "tls",
        sni: "cdn.example.com",
        fp: "chrome",
        alpn: "h2,http/1.1",
      }),
    );
    expect(r.outbound).toEqual({
      tag: "proxy",
      protocol: "vmess",
      settings: { vnext: [{ address: "de1.example.com", port: 443, users: [{ id: UUID, alterId: 0, security: "auto" }] }] },
      streamSettings: {
        network: "ws",
        security: "tls",
        tlsSettings: { allowInsecure: false, serverName: "cdn.example.com", alpn: ["h2", "http/1.1"], fingerprint: "chrome" },
        wsSettings: { path: "/vmess", headers: { Host: "cdn.example.com" } },
      },
    });
    expect(r.link).toMatchObject({ protocol: "vmess", remark: "Germany 01 🇩🇪", address: "de1.example.com", port: 443, network: "ws", security: "tls" });
    expect(r.config).toMatchObject({ remarks: "Germany 01 🇩🇪" });
    expect(r.warnings).toEqual([]);
  });

  it("VMess with a bug host (as fastssh decodes it): the link's own JSON, keys in order, plus a working config", () => {
    // Same shape as a v2rayNG export: address = bug host, Host/SNI = the real server, empty fp and type.
    const original = {
      add: "bug.example.com",
      aid: "0",
      alpn: "http/1.1",
      fp: "",
      host: "node.example.net",
      id: UUID,
      net: "ws",
      path: "/vmess",
      port: "443",
      ps: "demo-TLS",
      scy: "auto",
      sni: "node.example.net",
      tls: "tls",
      type: "",
      v: "2",
    };
    const r = convertLink(vmess(original));
    expect(r.decoded).toEqual(original);
    expect(Object.keys(r.decoded)).toEqual(Object.keys(original));
    expect(r.outbound).toEqual({
      tag: "proxy",
      protocol: "vmess",
      settings: { vnext: [{ address: "bug.example.com", port: 443, users: [{ id: UUID, alterId: 0, security: "auto" }] }] },
      streamSettings: {
        network: "ws",
        security: "tls",
        tlsSettings: { allowInsecure: false, serverName: "node.example.net", alpn: ["http/1.1"] },
        wsSettings: { path: "/vmess", headers: { Host: "node.example.net" } },
      },
    });
  });

  it("URI links decode to their parts: server, credential, every parameter, remark", () => {
    expect(convertLink(`vless://${UUID}@a.example.com:443?encryption=none&security=tls&sni=s.example.com&type=ws&path=%2Fv#My%20VLESS`).decoded).toEqual({
      protocol: "vless",
      address: "a.example.com",
      port: 443,
      id: UUID,
      encryption: "none",
      security: "tls",
      sni: "s.example.com",
      type: "ws",
      path: "/v",
      remark: "My VLESS",
    });
    expect(convertLink("trojan://pw@t.example.com:443#T").decoded).toEqual({
      protocol: "trojan",
      address: "t.example.com",
      port: 443,
      password: "pw",
      remark: "T",
    });
    expect(convertLink(`ss://${b64url("aes-256-gcm:pw")}@s.example.com:8388#S`).decoded).toEqual({
      protocol: "shadowsocks",
      address: "s.example.com",
      port: 8388,
      method: "aes-256-gcm",
      password: "pw",
      remark: "S",
    });
  });

  it("VMess: base64url without padding, numeric port, gRPC multi mode, legacy alterId", () => {
    const link = `vmess://${b64url(JSON.stringify({ add: "g.example.com", port: 8443, id: UUID, aid: 64, net: "grpc", type: "multi", path: "svc", tls: "tls" }))}`;
    const r = convertLink(link);
    expect(r.outbound.streamSettings).toEqual({
      network: "grpc",
      security: "tls",
      tlsSettings: { allowInsecure: false, serverName: "g.example.com" },
      grpcSettings: { serviceName: "svc", multiMode: true },
    });
    expect((r.outbound.settings as { vnext: { port: number; users: { alterId: number }[] }[] }).vnext[0]).toMatchObject({
      port: 8443,
      users: [{ alterId: 64 }],
    });
    expect(r.warnings.join(" ")).toMatch(/alterId 64/);
  });

  it("VMess: the newer URI form", () => {
    const r = convertLink(`vmess://${UUID}@v.example.com:443?type=ws&security=tls&path=%2Fp&host=v.example.com#URI%20form`);
    expect(r.link).toMatchObject({ protocol: "vmess", remark: "URI form", port: 443, network: "ws", path: "/p" });
    expect(r.outbound.settings).toEqual({ vnext: [{ address: "v.example.com", port: 443, users: [{ id: UUID, alterId: 0, security: "auto" }] }] });
  });

  it("VLESS: REALITY with Vision flow", () => {
    const r = convertLink(
      `vless://${UUID}@203.0.113.5:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=www.microsoft.com&fp=chrome&pbk=SbVKOEMjK0sIlbwg4akyBg5mL5KZwwB-ed4eEE7YnRc&sid=6ba85179e30d4fc2&spx=%2F&type=tcp&headerType=none#Reality%20Test`,
    );
    expect(r.outbound).toEqual({
      tag: "proxy",
      protocol: "vless",
      settings: { vnext: [{ address: "203.0.113.5", port: 443, users: [{ id: UUID, encryption: "none", flow: "xtls-rprx-vision" }] }] },
      streamSettings: {
        network: "tcp",
        security: "reality",
        realitySettings: {
          show: false,
          fingerprint: "chrome",
          serverName: "www.microsoft.com",
          publicKey: "SbVKOEMjK0sIlbwg4akyBg5mL5KZwwB-ed4eEE7YnRc",
          shortId: "6ba85179e30d4fc2",
          spiderX: "/",
        },
      },
    });
    expect(r.link.remark).toBe("Reality Test");
  });

  it("VLESS: WebSocket on port 80 without TLS keeps the port (URL would drop it)", () => {
    const r = convertLink(`vless://${UUID}@ws.example.com:80?type=ws&path=%2Fws&host=ws.example.com&security=none#ws80`);
    expect(r.outbound.streamSettings).toEqual({ network: "ws", security: "none", wsSettings: { path: "/ws", headers: { Host: "ws.example.com" } } });
    expect(r.link.port).toBe(80);
  });

  it("VLESS: IPv6 server, gRPC, TLS with the SNI from the link", () => {
    const r = convertLink(`vless://${UUID}@[2001:db8::1]:443?type=grpc&serviceName=grpc-svc&security=tls&sni=x.example.com#v6`);
    expect(r.link.address).toBe("2001:db8::1");
    expect(r.outbound.streamSettings).toEqual({
      network: "grpc",
      security: "tls",
      tlsSettings: { allowInsecure: false, serverName: "x.example.com" },
      grpcSettings: { serviceName: "grpc-svc", multiMode: false },
    });
  });

  it("Trojan: TLS by default, encoded password, port 443 when missing", () => {
    const r = convertLink("trojan://p%40ss%3Aw0rd@tr.example.com?sni=tr.example.com#Trojan");
    expect(r.outbound).toEqual({
      tag: "proxy",
      protocol: "trojan",
      settings: { servers: [{ address: "tr.example.com", port: 443, password: "p@ss:w0rd" }] },
      streamSettings: { network: "tcp", security: "tls", tlsSettings: { allowInsecure: false, serverName: "tr.example.com" } },
    });
  });

  it("Trojan: allowInsecure is kept, with a warning", () => {
    const r = convertLink("trojan://pw@1.2.3.4:443?security=tls&allowInsecure=1&type=ws&path=%2Ft#x");
    expect(r.outbound.streamSettings).toMatchObject({ tlsSettings: { allowInsecure: true }, wsSettings: { path: "/t" } });
    expect(r.warnings.join(" ")).toMatch(/certificate checks/);
  });

  it("Shadowsocks: SIP002 (base64 user info), 2022 keys in plain text, and the legacy all-base64 form", () => {
    let r = convertLink(`ss://${b64url("aes-256-gcm:secretpass")}@ss.example.com:8388#SS%20one`);
    expect(r.outbound).toEqual({
      tag: "proxy",
      protocol: "shadowsocks",
      settings: { servers: [{ address: "ss.example.com", port: 8388, method: "aes-256-gcm", password: "secretpass" }] },
      streamSettings: { network: "tcp" },
    });
    expect(r.link.remark).toBe("SS one");

    r = convertLink("ss://2022-blake3-aes-128-gcm:YctPZ6U7xPPcU%2Bgp3u%2B0tx%2FtRizJN9K8y%2BuKlW2qjlI%3D@ss.example.com:443#k");
    expect(r.link).toMatchObject({ method: "2022-blake3-aes-128-gcm", secret: "YctPZ6U7xPPcU+gp3u+0tx/tRizJN9K8y+uKlW2qjlI=", port: 443 });

    r = convertLink(`ss://${b64("chacha20-ietf-poly1305:pw@1.2.3.4:80")}#legacy`);
    expect(r.link).toMatchObject({ method: "chacha20-ietf-poly1305", secret: "pw", address: "1.2.3.4", port: 80, remark: "legacy" });
  });

  it("Shadowsocks: a plugin is left out, with a warning", () => {
    const r = convertLink(`ss://${b64url("aes-128-gcm:pw")}@s.example.com:443/?plugin=v2ray-plugin%3Bmode%3Dwebsocket#p`);
    expect(r.warnings.join(" ")).toMatch(/plugin "v2ray-plugin"/);
  });

  it("builds a complete client config around the outbound", () => {
    const r = convertLink(`vless://${UUID}@a.example.com:443?security=tls#A`);
    expect(r.config).toMatchObject({
      remarks: "A",
      inbounds: [
        { tag: "socks", port: 10808, listen: "127.0.0.1", protocol: "socks" },
        { tag: "http", port: 10809, listen: "127.0.0.1", protocol: "http" },
      ],
      outbounds: [
        { tag: "proxy", protocol: "vless" },
        { tag: "direct", protocol: "freedom" },
        { tag: "block", protocol: "blackhole" },
      ],
      routing: { rules: [{ ip: ["geoip:private"], outboundTag: "direct" }] },
    });
    // No remark, no "remarks" key.
    expect(convertLink(`vless://${UUID}@a.example.com:443`).config).not.toHaveProperty("remarks");
  });

  it("explains what's wrong with links it can't convert", () => {
    fails("", /Paste a vmess/);
    fails("   ", /Paste a vmess/);
    fails(`vless://${UUID}@a.example.com:443\nvless://${UUID}@b.example.com:443`, /one link at a time/);
    fails("hysteria2://pw@h.example.com:443#h", /Hysteria\/TUIC link/);
    fails("https://example.com", /isn't a V2Ray link/);
    fails("hello", /isn't a V2Ray link/);
    fails(`vless://${UUID}@a.example.com?security=tls`, /port/);
    fails("vless://@a.example.com:443", /no user ID/);
    fails("vmess://not-base64!!", /isn't in a format/);
    fails(vmess({ add: "a.example.com", port: "443" }), /no user ID/);
    fails(vmess({ add: "a.example.com", port: "99999", id: UUID }), /port/);
    fails("ss://bm90LWEtbGluaw", /isn't in a format/);
    fails(`vless://${UUID}@a.example.com:443?x=${"a".repeat(9000)}`, /too long/);
  });
});
