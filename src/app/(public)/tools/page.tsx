import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { PageHeader } from "@/components/public/page-header";
import { Container } from "@/components/public/section";
import { TOOLS } from "@/components/public/tools/registry";
import { pageMetadata } from "@/lib/seo";
import { loadSettings } from "../_lib/data";
import toolsImage from "@/assets/tools.webp";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return pageMetadata({
    title: "Tools",
    description: "Free network tools: check my IP, hostname to IP, IP to hostname (reverse DNS), domain age checker, V2Ray to JSON, and more on the way.",
    path: "/tools",
    siteName: settings.siteName,
  });
}

export default async function ToolsPage() {
  await connection();
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Tools" }]}
        icon={
          // eslint-disable-next-line @next/next/no-img-element -- small bundled picture; the header sizes it
          <img src={toolsImage.src} alt="" aria-hidden="true" width={64} height={64} draggable={false} className="rounded-2xl bg-white object-contain p-2" />
        }
        eyebrow="Free"
        title="Network tools"
        description="Handy tools for setting up your SSH and VPN apps. Free, no sign-up."
      />
      <Container className="pt-2 pb-16 sm:pb-24">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ slug, href, name, description, icon: Icon, image }) => (
            <li key={slug}>
              <Link
                href={href}
                className="group flex h-full flex-col rounded-3xl border bg-card p-5 shadow-sm outline-none transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-6 motion-reduce:hover:translate-y-0"
              >
                {image ? (
                  <span className="flex size-12 items-center justify-center rounded-2xl border bg-white p-1 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element -- small bundled picture */}
                    <img src={image.src} alt="" aria-hidden="true" width={48} height={48} draggable={false} className="size-full object-contain" />
                  </span>
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                    <Icon className="size-6" aria-hidden />
                  </span>
                )}
                <span className="mt-4 text-lg font-bold tracking-tight">{name}</span>
                <span className="mt-1 flex-1 text-sm text-muted-foreground">{description}</span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Open tool
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
          <li className="flex flex-col items-center justify-center rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <SparklesIcon className="mb-2 size-5" aria-hidden />
            More tools are on the way.
          </li>
        </ul>
      </Container>
    </>
  );
}
