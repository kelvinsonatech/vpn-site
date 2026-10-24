import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { connection } from "next/server";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { CopyAction } from "@/components/public/account/copy-action";
import { PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { RecheckButton } from "@/components/public/tools/my-ip-recheck";
import { pageMetadata } from "@/lib/seo";
import { clientIpFromHeaders } from "@/server/auth/request-context";
import { hashClientIp } from "@/server/crypto/hashing";
import { parseIpInput } from "@/server/tools/reverse";
import { loadSettings } from "../../_lib/data";
import { MyIpDetailsPanel, MyIpDetailsSkeleton } from "./details";
import toolImage from "@/assets/my-ip.webp";
import bandImage from "@/assets/my-ip-band.webp";
import { AdsenseScript } from "@/components/public/adsense-script";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return pageMetadata({
    title: "Check My IP",
    description: "See your public IP address, its hostname and network provider, and whether you're browsing through one of our servers. Free and instant.",
    path: "/tools/my-ip",
    siteName: settings.siteName,
  });
}

/** IPv6 addresses wrap after their colons on narrow screens rather than mid-group. */
function breakAtColons(ip: string) {
  return ip.split(":").map((part, i) => (
    <span key={i}>
      {i ? ":" : null}
      {i ? <wbr /> : null}
      {part}
    </span>
  ));
}

export default async function MyIpPage() {
  await connection();
  const [h, settings] = await Promise.all([headers(), loadSettings()]);
  const raw = clientIpFromHeaders(h);
  const parsed = parseIpInput(raw ?? "");
  const v6 = parsed.ok && parsed.ip.includes(":");
  return (
    <>
      <AdsenseScript />
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: "Check My IP" }]}
        icon={
          // eslint-disable-next-line @next/next/no-img-element -- small bundled picture; the header sizes it
          <img src={toolImage.src} alt="" aria-hidden="true" width={64} height={64} draggable={false} className="rounded-2xl bg-white object-contain p-1" />
        }
        eyebrow="Tool"
        title="Check My IP"
        description="The public IP address websites see when you visit them, who it belongs to, and whether you're browsing through one of our servers."
      />
      <Container className="grid max-w-3xl gap-8 pt-2 pb-16 sm:pb-24">
        {parsed.ok ? (
          <section aria-labelledby="my-ip-heading" className="grid gap-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
            {/* The address over a pastel desk photo: flipped so the props sit behind the buttons, and faded into the page colour (light or dark) behind the words. */}
            <div className="relative isolate flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-2xl px-5 py-6 ring-1 ring-black/5 sm:px-7 sm:py-8 dark:ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- bundled background picture */}
              <img
                src={bandImage.src}
                alt=""
                aria-hidden="true"
                width={bandImage.width}
                height={bandImage.height}
                decoding="async"
                draggable={false}
                className="absolute inset-0 -z-20 size-full -scale-x-100 object-cover object-[0%_100%] sm:object-[0%_78%]"
              />
              {/* Phones: an even wash (the words run the full width). Larger screens: fade from the words to the photo. */}
              <span
                aria-hidden
                className="absolute inset-0 -z-10 bg-[color-mix(in_oklch,var(--background)_80%,transparent)] sm:hidden dark:bg-[color-mix(in_oklch,var(--background)_88%,transparent)]"
              />
              <span
                aria-hidden
                className="absolute inset-0 -z-10 hidden bg-[linear-gradient(to_right,color-mix(in_oklch,var(--background)_95%,transparent)_40%,color-mix(in_oklch,var(--background)_60%,transparent)_62%,color-mix(in_oklch,var(--background)_10%,transparent))] sm:block"
              />
              <div className="min-w-0">
                <h2 id="my-ip-heading" className="text-sm font-medium text-muted-foreground">
                  Your public IP address
                </h2>
                <p
                  className={`mt-1 font-mono font-bold tracking-tight select-all ${v6 ? "text-xl [overflow-wrap:anywhere] sm:text-2xl" : "text-3xl sm:text-4xl"}`}
                >
                  {v6 ? breakAtColons(parsed.ip) : parsed.ip}
                </p>
                <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">{v6 ? "IPv6" : "IPv4"}</span>
                  Your browser reached us over {v6 ? "IPv6" : "IPv4"}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CopyAction value={parsed.ip} label="Copy IP address" variant="outline" size="default" className="rounded-full">
                  Copy
                </CopyAction>
                <RecheckButton ip={parsed.ip} />
              </div>
            </div>
            {/* Keyed by the address, so a new one (after connecting a tunnel) shows the placeholder rather than the old details. */}
            <Suspense key={parsed.ip} fallback={<MyIpDetailsSkeleton />}>
              <MyIpDetailsPanel ip={parsed.ip} clientKey={hashClientIp(raw)} siteName={settings.siteName} />
            </Suspense>
          </section>
        ) : (
          <section aria-labelledby="my-ip-heading" className="flex items-start gap-3 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-warning-strong" aria-hidden />
            <div className="min-w-0 text-sm">
              <h2 id="my-ip-heading" className="text-base font-bold">
                We can&apos;t see a public IP address
              </h2>
              <p className="mt-1 text-muted-foreground">
                Your request reached us from {parsed.ip ? <span className="font-mono text-foreground">{parsed.ip}</span> : "an unknown address"}, which
                isn&apos;t a public internet address. That happens on a local network or behind some proxies. Try again from your normal connection.
              </p>
            </div>
          </section>
        )}

        <section aria-labelledby="about-tool" className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground shadow-sm sm:p-6">
          <h2 id="about-tool" className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
            <InfoIcon className="size-4 text-primary" aria-hidden />
            How it works
          </h2>
          <ul className="grid list-disc gap-2 pl-5 marker:text-primary/60">
            <li>
              This is the address your connection uses on the internet. Every website and app you connect to sees it, and it usually reveals your provider and
              rough location.
            </li>
            <li>Many connections have both an IPv4 and an IPv6 address. This shows the one your browser used to reach us.</li>
            <li>
              <strong className="font-semibold text-foreground">Hostname</strong> is the reverse DNS name the address&apos;s owner set, often your
              provider&apos;s. <strong className="font-semibold text-foreground">Provider</strong>, ASN, country and IP range come from the public internet
              routing records (via Team Cymru&apos;s free lookup service). The country is where the network is registered, which is usually, but not always,
              where you are.
            </li>
            <li>
              When your browser goes through a {settings.siteName} tunnel, you&apos;ll see the server&apos;s address here and a green{" "}
              <strong className="font-semibold text-foreground">You&apos;re browsing through {settings.siteName}</strong> note.{" "}
              <Link href="/#protocols" className="font-medium text-primary underline-offset-2 hover:underline">
                Get a free account
              </Link>
              .
            </li>
            <li>Your address is read from your request and isn&apos;t saved. We only query DNS; nothing connects to your device.</li>
          </ul>
        </section>
      </Container>
    </>
  );
}
