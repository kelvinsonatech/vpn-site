import type { Metadata } from "next";
import { FileJsonIcon, InfoIcon } from "lucide-react";
import { PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { V2rayToJson } from "@/components/public/tools/v2ray-to-json";
import { pageMetadata } from "@/lib/seo";
import { loadSettings } from "../../_lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return pageMetadata({
    title: "V2Ray to JSON",
    description: "Decode a vmess://, vless://, trojan:// or ss:// link to JSON and get a ready-to-use V2Ray/Xray config. Runs in your browser; free.",
    path: "/tools/v2ray-to-json",
    siteName: settings.siteName,
  });
}

export default function V2rayToJsonPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: "V2Ray to JSON" }]}
        icon={<FileJsonIcon />}
        eyebrow="Tool"
        title="V2Ray to JSON"
        description="Paste a vmess, vless, trojan or ss link to see what's inside it as JSON, and get a config you can run with V2Ray or Xray."
      />
      <Container className="grid max-w-3xl gap-8 pt-2 pb-16 sm:pb-24">
        <V2rayToJson />
        <section aria-labelledby="about-tool" className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground shadow-sm sm:p-6">
          <h2 id="about-tool" className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
            <InfoIcon className="size-4 text-primary" aria-hidden />
            How it works
          </h2>
          <ul className="grid list-disc gap-2 pl-5 marker:text-primary/60">
            <li>
              <strong className="font-semibold text-foreground">Decoded JSON</strong> shows exactly what the link contains. A vmess:// link is base64-encoded
              JSON, so you get that JSON back as it was written; for vless://, trojan:// and ss:// links you get the server, the ID or password and every
              setting in the link.
            </li>
            <li>
              <strong className="font-semibold text-foreground">Xray config</strong> is a complete client config: it opens a SOCKS proxy on 127.0.0.1:10808 and
              an HTTP proxy on 127.0.0.1:10809 and sends traffic through your server. Run it with{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">xray run -c config.json</code>, or import it as a custom
              config in apps such as v2rayN and v2rayNG.
            </li>
            <li>
              <strong className="font-semibold text-foreground">Outbound only</strong> is just the server part, for adding to a config you already have.
            </li>
            <li>Everything happens in your browser. A link contains your account&apos;s ID or password, so it&apos;s never sent to our server or saved.</li>
          </ul>
        </section>
      </Container>
    </>
  );
}
