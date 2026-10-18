import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { GlobeIcon, InfoIcon } from "lucide-react";
import { PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { IpToHostname } from "@/components/public/tools/ip-to-hostname";
import { pageMetadata } from "@/lib/seo";
import { clientIpFromHeaders } from "@/server/auth/request-context";
import { parseIpInput } from "@/server/tools/reverse";
import { loadSettings } from "../../_lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return pageMetadata({
    title: "IP to Hostname",
    description: "Find the hostname of any IPv4 or IPv6 address with a reverse DNS lookup. Free and instant.",
    path: "/tools/ip-to-hostname",
    siteName: settings.siteName,
  });
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function IpToHostnamePage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const ip = (await searchParams).ip;
  // The visitor's own address, offered as a one-tap example (only when it is a public one).
  const mine = parseIpInput(clientIpFromHeaders(await headers()) ?? "");
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: "IP to Hostname" }]}
        icon={<GlobeIcon />}
        eyebrow="Tool"
        title="IP to Hostname"
        description="Enter an IP address to see the hostname it belongs to (reverse DNS)."
      />
      <Container className="grid max-w-3xl gap-8 pt-2 pb-16 sm:pb-24">
        <IpToHostname initialIp={typeof ip === "string" ? ip.slice(0, 300) : ""} myIp={mine.ok ? mine.ip : null} />
        <section aria-labelledby="about-tool" className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground shadow-sm sm:p-6">
          <h2 id="about-tool" className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
            <InfoIcon className="size-4 text-primary" aria-hidden />
            How it works
          </h2>
          <ul className="grid list-disc gap-2 pl-5 marker:text-primary/60">
            <li>
              The owner of an IP address can give it a name in DNS (a <strong className="font-semibold text-foreground">PTR record</strong>). This tool asks DNS for
              that name.
            </li>
            <li>
              <strong className="font-semibold text-foreground">Verified</strong> means the hostname also points back to the same IP, so the two really belong
              together.
            </li>
            <li>Many addresses have no hostname at all, and mobile data addresses usually show your network provider&apos;s name.</li>
            <li>Only public addresses can be looked up. We only query DNS; nothing connects to the address, and lookups aren&apos;t saved.</li>
          </ul>
        </section>
      </Container>
    </>
  );
}
