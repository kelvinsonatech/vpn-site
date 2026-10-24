import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { connection } from "next/server";
import { InfoIcon } from "lucide-react";
import { PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { IpToHostname } from "@/components/public/tools/ip-to-hostname";
import { pageMetadata } from "@/lib/seo";
import { clientIpFromHeaders } from "@/server/auth/request-context";
import { parseIpInput } from "@/server/tools/reverse";
import { loadSettings } from "../../_lib/data";
import toolImage from "@/assets/ip-to-hostname.webp";
import { AdsenseScript } from "@/components/public/adsense-script";

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
      <AdsenseScript />
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: "IP to Hostname" }]}
        icon={
          // eslint-disable-next-line @next/next/no-img-element -- small bundled picture; the header sizes it
          <img src={toolImage.src} alt="" aria-hidden="true" width={64} height={64} draggable={false} className="rounded-2xl bg-white object-contain p-1" />
        }
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
            <li>
              <strong className="font-semibold text-foreground">Websites on this IP</strong> lists websites people have looked up with{" "}
              <Link href="/tools/hostname-to-ip" className="font-medium text-primary underline-offset-2 hover:underline">
                Hostname to IP
              </Link> that point to this address. Each one is checked in DNS during your lookup, so the list is
              current. A website you look up there normally shows here straight away.
            </li>
            <li>
              Websites on shared hosting or a CDN share their provider&apos;s IPs with many other sites. For those you&apos;ll see the provider&apos;s name (for
              example <span className="font-mono text-foreground">…ingress.render.com</span>) as the reverse DNS name. That&apos;s how reverse DNS works
              everywhere.
            </li>
            <li>
              <strong className="font-semibold text-foreground">Owner of this IP</strong> shows the network the address belongs to, from the public internet
              routing records (via Team Cymru&apos;s free lookup service).
            </li>
            <li>Many addresses have no hostname at all, and mobile data addresses usually show your network provider&apos;s name.</li>
            <li>Only public addresses can be looked up. We only query DNS; nothing connects to the address, and IP lookups aren&apos;t saved.</li>
          </ul>
        </section>
      </Container>
    </>
  );
}
