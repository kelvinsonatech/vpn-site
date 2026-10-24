import type { Metadata } from "next";
import { connection } from "next/server";
import { InfoIcon } from "lucide-react";
import { PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { DomainAgeChecker } from "@/components/public/tools/domain-age";
import { pageMetadata } from "@/lib/seo";
import { loadSettings } from "../../_lib/data";
import toolImage from "@/assets/domain-age.webp";
import { AdsenseScript } from "@/components/public/adsense-script";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return pageMetadata({
    title: "Domain Age Checker",
    description: "Find out how old any domain is: its registration date, expiry date and registrar, straight from the registry. Free and instant.",
    path: "/tools/domain-age",
    siteName: settings.siteName,
  });
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DomainAgePage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const domain = (await searchParams).domain;
  return (
    <>
      <AdsenseScript />
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: "Domain Age Checker" }]}
        icon={
          // eslint-disable-next-line @next/next/no-img-element -- small bundled picture; the header sizes it
          <img src={toolImage.src} alt="" aria-hidden="true" width={64} height={64} draggable={false} className="rounded-2xl bg-white object-contain p-1" />
        }
        eyebrow="Tool"
        title="Domain Age Checker"
        description="Type a domain name to see how old it is, when it was registered and when it expires."
      />
      <Container className="grid max-w-3xl gap-8 pt-2 pb-16 sm:pb-24">
        <DomainAgeChecker initialDomain={typeof domain === "string" ? domain.slice(0, 300) : ""} />
        <section aria-labelledby="about-tool" className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground shadow-sm sm:p-6">
          <h2 id="about-tool" className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
            <InfoIcon className="size-4 text-primary" aria-hidden />
            How it works
          </h2>
          <ul className="grid list-disc gap-2 pl-5 marker:text-primary/60">
            <li>
              Every domain is registered through its registry (Verisign for <span className="font-mono text-foreground">.com</span>, Nominet for{" "}
              <span className="font-mono text-foreground">.uk</span> and so on). This tool asks the registry for the domain&apos;s public record, using{" "}
              <strong className="font-semibold text-foreground">RDAP</strong>, or <strong className="font-semibold text-foreground">WHOIS</strong> where the
              registry has no RDAP.
            </li>
            <li>The age counts from the registration date in that record. If a domain expired and was registered again, it counts from the new registration.</li>
            <li>
              Subdomains are checked as their main domain: <span className="font-mono text-foreground">www.example.com</span> shows{" "}
              <span className="font-mono text-foreground">example.com</span>.
            </li>
            <li>Some registries don&apos;t publish registration dates, and a few have no public lookup at all. The result says so when that happens.</li>
            <li>Only the registry is asked; nothing connects to the website. Contact details in the record are never read or shown.</li>
          </ul>
        </section>
      </Container>
    </>
  );
}
