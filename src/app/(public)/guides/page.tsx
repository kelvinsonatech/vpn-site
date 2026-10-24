import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRightIcon, BookOpenIcon, ClockIcon, LibraryIcon } from "lucide-react";
import { HeroChip, PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { GUIDE_CATEGORIES, GUIDES, readingMinutes } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";
import { loadSettings } from "../_lib/data";
import { AdsenseScript } from "@/components/public/adsense-script";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return pageMetadata({
    title: "Guides",
    description: `Step-by-step guides for ${settings.siteName} accounts: setting up the apps, how each protocol works, fixing connection problems and staying private.`,
    path: "/guides",
    siteName: settings.siteName,
  });
}

export default async function GuidesPage() {
  await connection();
  const settings = await loadSettings();
  return (
    <>
      <AdsenseScript />
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Guides", href: "/guides" },
        ]}
        icon={<BookOpenIcon />}
        eyebrow="Help center"
        title="Guides"
        description={`How to set up and use your ${settings.siteName} account, what each protocol does, and what to try when something doesn't work.`}
      >
        <HeroChip icon={<LibraryIcon />}>{GUIDES.length} guides</HeroChip>
      </PageHeader>
      <Container className="grid gap-12 pt-2 pb-16 sm:pb-24">
        {GUIDE_CATEGORIES.map((category) => {
          const guides = GUIDES.filter((g) => g.category === category);
          if (!guides.length) return null;
          const id = `cat-${category.toLowerCase().replace(/[^a-z]+/g, "-")}`;
          return (
            <section key={category} aria-labelledby={id}>
              <h2 id={id} className="mb-5 text-xl font-bold tracking-tight sm:text-2xl">
                {category}
              </h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/guides/${g.slug}`}
                      className="group flex h-full flex-col rounded-3xl border bg-card p-5 shadow-sm outline-none transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-6 motion-reduce:hover:translate-y-0"
                    >
                      <span className="text-lg font-bold tracking-tight text-balance">{g.title}</span>
                      <span className="mt-2 flex-1 text-sm text-muted-foreground">{g.description}</span>
                      <span className="mt-5 flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <ClockIcon className="size-4" aria-hidden />
                          {readingMinutes(g)} min read
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                          Read
                          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </Container>
    </>
  );
}
