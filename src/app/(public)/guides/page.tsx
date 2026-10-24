import type { Metadata } from "next";
import { connection } from "next/server";
import { BookOpenIcon, LibraryIcon } from "lucide-react";
import { HeroChip, PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { GuideCard, revealClass } from "@/components/public/guides/guide-card";
import { GUIDE_CATEGORIES, GUIDES } from "@/lib/guides";
import { guideCover } from "@/lib/guides/covers";
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
                {guides.map((g, i) => (
                  <li key={g.slug} className={revealClass(i)}>
                    <GuideCard guide={g} cover={guideCover(g.slug)} />
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
