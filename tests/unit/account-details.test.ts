import { describe, expect, it } from "vitest";
import { publicDetails } from "@/components/public/account/account-sections";
import type { PublicAccountResult } from "@/lib/public/types";

const field = (key: string, label: string, kind: PublicAccountResult["fields"][number]["kind"], value: string, sensitive = false) => ({
  key,
  label,
  kind,
  value,
  sensitive,
  copyable: true,
  qr: false,
});

const account: PublicAccountResult = {
  protocol: { slug: "vless", name: "VLESS" },
  server: { id: "s1", name: "Canada 01" },
  username: "traveller",
  expiresAt: "2026-10-25T00:00:00.000Z",
  avatar: "data:image/svg+xml;base64,AAAA",
  fields: [
    field("host", "Host", "text", "tests.example.com"),
    field("username", "Username", "text", "traveller"),
    field("password", "Password", "secret", "Blue-Ocean-2026x", true),
    field("uuid", "UUID", "secret", "0b6f8e0e-0000-4000-8000-000000000000", true),
    field("udp_custom_config", "UDP Custom config", "secret", "tests.example.com:1-65535@traveller:Blue-Ocean-2026x", true),
    field("ws_ports", "WebSocket port", "text", "80"),
    field("payload", "Payload", "multiline", "GET / HTTP/1.1[crlf]Host: tests.example.com[crlf][crlf]"),
    field("private_note", "Sensitive text", "text", "do-not-keep", true),
    field("empty", "Empty", "text", ""),
  ],
  artifacts: [
    { key: "link_1", label: "VLESS WS", kind: "uri", content: "vless://0b6f8e0e@tests.example.com:443", qr: true, sensitive: true },
    { key: "conf", label: "Client config", kind: "file", content: "[Interface]\nPrivateKey = abc", filename: "client.conf", qr: false, sensitive: true },
  ],
};

describe("details kept in My accounts", () => {
  const kept = publicDetails(account);
  const all = JSON.stringify(kept);

  it("keeps plain connection details in display order", () => {
    expect(kept.map((d) => d.label)).toEqual(["Host", "Username", "WebSocket port", "Payload"]);
    expect(kept[0]).toEqual({ label: "Host", value: "tests.example.com" });
  });

  it("never keeps passwords, UUIDs, configs, sensitive text, links or files", () => {
    for (const secret of ["Blue-Ocean-2026x", "0b6f8e0e", "do-not-keep", "vless://", "PrivateKey"]) expect(all).not.toContain(secret);
  });
});
