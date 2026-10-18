import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { InfoIcon, NetworkIcon } from "lucide-react";
import { PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { HostnameToIp } from "@/components/public/tools/hostname-to-ip";
import { pageMetadata } from "@/lib/seo";
import { loadSettings } from "../../_lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return pageMetadata({
    title: "Hostname to IP",
    description: "Convert any hostname or link to its IPv4 and IPv6 addresses. Free, instant DNS lookup.",
    path: "/tools/hostname-to-ip",
    siteName: settings.siteName,
  });
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HostnameToIpPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const host = (await searchParams).host;
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: "Hostname to IP" }]}
        icon={<NetworkIcon />}
        eyebrow="Tool"
        title="Hostname to IP"
        description="Type a hostname or paste a link to see the IP addresses it points to."
      />
      <Container className="grid max-w-3xl gap-8 pt-2 pb-16 sm:pb-24">
        <HostnameToIp initialHost={typeof host === "string" ? host.slice(0, 300) : ""} />
        <section aria-labelledby="about-tool" className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground shadow-sm sm:p-6">
          <h2 id="about-tool" className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
            <InfoIcon className="size-4 text-primary" aria-hidden />
            How it works
          </h2>
          <ul className="grid list-disc gap-2 pl-5 marker:text-primary/60">
            <li>
              Every website or server name (like <span className="font-mono text-foreground">example.com</span>) points to one or more IP addresses through DNS.
              This tool asks DNS for them: <strong className="font-semibold text-foreground">IPv4</strong> (A records) and{" "}
              <strong className="font-semibold text-foreground">IPv6</strong> (AAAA records).
            </li>
            <li>Big sites often return several addresses, and they can change over time. The TTL shows how long an answer may be cached.</li>
            <li>Handy when an app asks for a server, proxy or SNI host as an IP address instead of a name.</li>
            <li>
              We only look the name up in DNS; nothing connects to the site. The hostname and the IPs it points to are remembered (never who looked it up)
              so <Link href="/tools/ip-to-hostname" className="font-medium text-primary underline-offset-2 hover:underline">
                IP to Hostname
              </Link> can show which websites use an IP, which means anyone can see it there: don&apos;t look up private names. IPs on your own connection
              and dynamic-DNS names are never remembered.
            </li>
          </ul>
        </section>
      </Container>
    </>
  );
}
