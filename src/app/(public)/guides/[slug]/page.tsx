import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";
import { ArrowRightIcon, BookOpenIcon, CalendarIcon, ClockIcon } from "lucide-react";
import { Faq, faqJsonLd } from "@/components/public/faq";
import { GuideBlockView } from "@/components/public/guides/guide-blocks";
import { RichText } from "@/components/public/guides/rich-text";
import { JsonLd } from "@/components/public/json-ld";
import { HeroChip, PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { ProtocolIcon } from "@/components/protocol-icon";
import { getGuide, plainText, readingMinutes } from "@/lib/guides";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { loadProtocols, loadSettings } from "../../_lib/data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  const settings = await loadSettings();
  return pageMetadata({ title: guide.title, description: guide.description, path: `/guides/${guide.slug}`, siteName: settings.siteName });
}

const sectionId = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const dateLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function GuidePage({ params }: Props) {
  await connection();
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const [settings, protocols, nonce] = await Promise.all([loadSettings(), loadProtocols(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  // "Create account" only for protocols this site lists right now (never a link to an empty page).
  const offered = protocols.filter((p) => guide.protocols.includes(p.slug));
  const related = guide.related.map(getGuide).filter((g) => g !== undefined);
  const faq = (guide.faq ?? []).map((f) => ({ q: f.q, a: plainText(f.a) }));
  const sections = guide.sections.map((s) => ({ ...s, id: sectionId(s.heading) }));

  return (
    <>
      <JsonLd
        nonce={nonce}
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          dateModified: guide.updated,
          mainEntityOfPage: absoluteUrl(`/guides/${guide.slug}`),
          publisher: { "@type": "Organization", name: settings.siteName },
        }}
      />
      {faq.length ? <JsonLd nonce={nonce} data={faqJsonLd(faq)} /> : null}
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Guides", href: "/guides" },
          { label: guide.title, href: `/guides/${guide.slug}` },
        ]}
        icon={<BookOpenIcon />}
        eyebrow={guide.category}
        title={guide.title}
        description={guide.description}
      >
        <HeroChip icon={<ClockIcon />}>{readingMinutes(guide)} min read</HeroChip>
        <HeroChip icon={<CalendarIcon />}>Updated {dateLabel(guide.updated)}</HeroChip>
      </PageHeader>

      <Container className="grid gap-8 pt-4 pb-16 sm:pb-24 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24">
            <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">On this page</p>
            <ol className="space-y-1 border-l text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px block border-l border-transparent py-1 pl-4 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
              {faq.length ? (
                <li>
                  <a
                    href="#questions"
                    className="-ml-px block border-l border-transparent py-1 pl-4 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    Questions
                  </a>
                </li>
              ) : null}
            </ol>
          </nav>
        </aside>

        <div className="grid min-w-0 gap-8">
          <article className="min-w-0 rounded-3xl border bg-card p-6 shadow-sm sm:p-10">
            <div className="prose-vl">
              {guide.intro.map((p) => (
                <p key={p} className="text-base text-foreground/90">
                  <RichText text={p} />
                </p>
              ))}
              {sections.map((s) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-28">
                  <h2 id={`${s.id}-title`}>{s.heading}</h2>
                  {s.blocks.map((b, i) => (
                    <GuideBlockView key={i} block={b} />
                  ))}
                </section>
              ))}
            </div>
          </article>

          <section aria-labelledby="try-title" className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <h2 id="try-title" className="text-lg font-bold tracking-tight">
              {offered.length ? "Try it with a free account" : "Pick a service"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {offered.length
                ? "Choose a protocol, then a server near you. Your details are shown once, so save them before you leave the page."
                : `See every protocol ${settings.siteName} offers right now and the servers that have free slots.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {offered.map((p) => (
                <Link
                  key={p.slug}
                  href={p.href}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ProtocolIcon name={p.icon} className="size-5" />
                  {p.name}
                </Link>
              ))}
              <Link
                href="/#protocols"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                All services
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </div>
          </section>

          {faq.length ? (
            <section id="questions" aria-labelledby="questions-title" className="scroll-mt-28">
              <h2 id="questions-title" className="mb-4 text-xl font-bold tracking-tight">
                Questions
              </h2>
              <Faq items={faq} />
            </section>
          ) : null}

          {related.length ? (
            <section aria-labelledby="related-title">
              <h2 id="related-title" className="mb-4 text-xl font-bold tracking-tight">
                Related guides
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {related.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/guides/${g.slug}`}
                      className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm outline-none transition-colors hover:border-primary/30 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="text-xs font-semibold tracking-wide text-primary uppercase">{g.category}</span>
                      <span className="mt-1 font-semibold text-balance">{g.title}</span>
                      <span className="mt-1 text-sm text-muted-foreground">{g.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Container>
    </>
  );
}
