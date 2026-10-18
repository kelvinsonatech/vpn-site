import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { connection } from "next/server";
import {
  ActivityIcon,
  ArrowRightIcon,
  CopyIcon,
  KeyRoundIcon,
  LayersIcon,
  MousePointerClickIcon,
  ServerIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  UserRoundIcon,
  ZapIcon,
} from "lucide-react";
import { ProtocolIcon } from "@/components/protocol-icon";
import { UserAvatar } from "@/components/user-avatar";
import { AvailabilityBadge } from "@/components/public/availability-badge";
import { CountUp } from "@/components/public/count-up";
import { CtaBand, heroPrimaryButton, heroSecondaryButton } from "@/components/public/cta-band";
import { Faq, faqJsonLd, type FaqItem } from "@/components/public/faq";
import { Flag } from "@/components/public/flag";
import { formatDayRange, formatDays } from "@/components/public/format";
import { HeroArt, type HeroArtServer } from "@/components/public/hero-art";
import { HeroWave } from "@/components/public/hero-wave";
import { JsonLd } from "@/components/public/json-ld";
import { Latency } from "@/components/public/latency";
import { HeroDecor } from "@/components/public/page-header";
import { ServiceCatalog } from "@/components/public/service-catalog";
import { Container, EmptyState, SectionHeading } from "@/components/public/section";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import type { PublicServerCard, StatusPageData } from "@/lib/public/types";
import { avatarDataUri } from "@/server/avatar";
import { loadProtocols, loadSettings, loadStats, loadStatus, joinTimes, zoneLabel } from "../_lib/data";
import chooseProtocolImage from "@/assets/step-choose-protocol.webp";
import pickServerImage from "@/assets/step-pick-server.webp";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return {
    ...pageMetadata({ title: settings.tagline || "Private tunnels", description: settings.seoDescription, path: "/", siteName: settings.siteName }),
    // The home page uses the plain site name as its title (no "· Site" suffix).
    title: { absolute: settings.tagline ? `${settings.siteName} · ${settings.tagline}` : settings.siteName },
  };
}

type LiveEntry = { server: PublicServerCard; protocol: string; protocolIcon: string };

/**
 * A handful of live servers for the hero chips and the status strip: open ones first, best ping
 * first, and each server once before any server repeats with another protocol (variety over ping).
 */
function liveEntries(status: StatusPageData | null, limit: number): LiveEntry[] {
  if (!status) return [];
  const all: LiveEntry[] = status.sections.flatMap((s) => s.servers.map((server) => ({ server, protocol: s.protocol.name, protocolIcon: s.protocol.icon })));
  const rank = (a: LiveEntry) => (a.server.availability === "available" ? 0 : a.server.availability === "full" ? 1 : 2);
  const sorted = all.sort((a, b) => rank(a) - rank(b) || (a.server.latencyMs ?? 9e9) - (b.server.latencyMs ?? 9e9));
  const seen = new Set<string>();
  const firsts = sorted.filter((e) => !seen.has(e.server.id) && seen.add(e.server.id));
  return [...firsts, ...sorted.filter((e) => !firsts.includes(e))].slice(0, limit);
}

const STEPS: { icon: React.ReactNode; image?: StaticImageData; title: string; text: string }[] = [
  { icon: <LayersIcon />, image: chooseProtocolImage, title: "Choose a protocol", text: "SSH, V2Ray, Trojan, UDP and more. Not sure? The guide on each page explains which app to use." },
  { icon: <MousePointerClickIcon />, image: pickServerImage, title: "Pick a server", text: "See live status, ping and free slots for every location, then open the server you like." },
  { icon: <CopyIcon />, title: "Copy your config", text: "Your account is created on the server in seconds. Copy it, scan the QR code or download the file." },
];

export default async function HomePage() {
  await connection();
  const [settings, protocols, stats, status] = await Promise.all([loadSettings(), loadProtocols(), loadStats(), loadStatus()]);
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const best = [...protocols].sort((a, b) => b.availableCount - a.availableCount || b.serverCount - a.serverCount)[0];
  const primaryHref = best && best.availableCount > 0 ? best.href : "/#protocols";
  const live = liveEntries(status, 6);
  const allDays = protocols.flatMap((p) => p.durationOptions);
  const validity = allDays.length ? formatDayRange(allDays) : "3–30 days";
  const countries = stats?.countries ?? new Set(protocols.flatMap((p) => p.countries.map((c) => c.code))).size;
  const resetText = `${joinTimes(settings.quota.resetTimes)} (${zoneLabel(settings.quota.timezone)})`;

  const sampleEntry = live[0];
  const heroCountries = new Set<string>();
  const heroServers: HeroArtServer[] = live
    .filter((e) => e.server.availability === "available" && !heroCountries.has(e.server.country.code) && heroCountries.add(e.server.country.code))
    .slice(0, 2)
    .map((e) => ({
    key: `${e.protocol}-${e.server.id}`,
    name: e.server.name,
    protocol: e.protocol,
    countryCode: e.server.country.code,
    latencyMs: e.server.latencyMs,
    remaining: e.server.capacity.remaining,
  }));
  const heroAvatar = avatarDataUri("vaultline-hero-traveller", settings.avatarStyle);
  const profileSeeds = ["aurora", "comet", "harbor", "nova", "atlas", "ember", "lumen", "pixel"];
  const profiles = profileSeeds.map((seed) => ({ seed, src: avatarDataUri(`sample:${seed}`, settings.avatarStyle) }));

  const faq: FaqItem[] = [
    {
      q: "Is it really free?",
      a: `Yes. Every server has a number of free slots per protocol. They refill every day at ${resetText}. When a server is full, pick another location or come back after the next reset.`,
    },
    {
      q: "How long does an account last?",
      a: `Between ${validity}, depending on the protocol: you choose the validity on the server page. The account expires automatically afterwards and is removed from the server.`,
    },
    {
      q: "Why are my details shown only once?",
      a: "Your password, keys and config files are generated on the server and handed to your browser as an encrypted one-time result. We keep that encrypted result for at most an hour, so reloading the page does not lose it, then erase it; it is never written to logs. Copy them or download the file before you leave the page.",
    },
    {
      q: "Which protocol should I choose?",
      a: "For most phones SSH or SSH SSL with HTTP Custom works well. V2Ray (VLESS or VMess) and Trojan are great when you want a share link and wide app support. Hysteria and UDP protocols are fastest on unstable mobile networks. Each protocol page has a short guide.",
    },
    {
      q: "What do “slots left” and the reset time mean?",
      a: "Slots are how many new accounts a server can still accept in the current period. The counter starts again at every reset time. Existing accounts keep working until they expire.",
    },
    {
      q: "Can I use one account on several devices?",
      a: "Please don't: one account is meant for one device. Logging in from a second device usually disconnects the first one. Create another account for each device instead.",
    },
    {
      q: "Do you log what I do?",
      a: "No browsing logs. We never store raw IP addresses: abuse protection uses a keyed hash that cannot be turned back into an IP. See the privacy policy for the full list of what is kept and for how long.",
    },
    {
      q: "A server isn't working. What can I do?",
      a: "Check the server status page first: it shows live status and ping for every server. If a server shows online but doesn't work for you, use “Report a problem” so we can look into it.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: settings.siteName,
      url: absoluteUrl("/"),
      description: settings.seoDescription,
    },
    faqJsonLd(faq),
  ];

  return (
    <>
      <JsonLd data={jsonLd} nonce={nonce} />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-hero text-hero-foreground" aria-labelledby="hero-title">
        <HeroDecor />
        <Container className="relative grid items-center gap-12 pt-12 pb-28 sm:pt-16 sm:pb-36 lg:grid-cols-2 lg:gap-8 lg:pt-20 lg:pb-44">
          <div className="animate-in text-center duration-700 fade-in fill-mode-both slide-in-from-bottom-4 lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-medium ring-1 ring-white/25 backdrop-blur-sm sm:text-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-70 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
              </span>
              {stats ? `${stats.serversOnline} servers online in ${countries} ${countries === 1 ? "country" : "countries"}` : "Free VPN & SSH accounts"}
            </p>
            <h1 id="hero-title" className="mt-6 text-4xl font-extrabold tracking-tight text-balance drop-shadow-sm sm:text-5xl lg:text-6xl">
              {settings.tagline || "Private tunnels, provisioned in seconds."}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-white/85 sm:text-lg lg:mx-0">
              Free SSH, V2Ray, Trojan, Hysteria and UDP accounts on fast servers around the world. Created on the server in seconds, delivered once to your
              browser and erased from our side within an hour.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
              <Link href={primaryHref} className={heroPrimaryButton}>
                <KeyRoundIcon />
                Create free account
                <ArrowRightIcon />
              </Link>
              <Link href="/server-status" className={heroSecondaryButton}>
                <ActivityIcon />
                Live server status
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/85 lg:justify-start">
              {["No sign-up or email", "No browsing logs", "Shown once, then erased"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <ShieldCheckIcon className="size-4 text-white" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            {stats ? (
              <dl className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-2 sm:gap-3 lg:mx-0">
                {[
                  { label: "Servers online", value: stats.serversOnline },
                  { label: "Countries", value: stats.countries },
                  settings.display.showStats
                    ? { label: "Accounts today", value: stats.accountsToday }
                    : { label: "Protocols", value: protocols.length },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col-reverse rounded-2xl bg-white/10 px-3 py-3 ring-1 ring-white/20 backdrop-blur-sm sm:px-4">
                    <dt className="mt-0.5 text-[11px] text-white/75 sm:text-xs">{s.label}</dt>
                    <dd className="text-2xl font-bold tabular-nums sm:text-3xl">
                      <CountUp value={s.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          <div className="hidden animate-in delay-200 duration-700 fade-in fill-mode-both zoom-in-95 md:block">
            <HeroArt
              avatar={heroAvatar}
              servers={heroServers}
              sample={{
                protocol: sampleEntry?.protocol ?? best?.name ?? "VLESS",
                server: sampleEntry?.server.name ?? "Server 1",
                countryCode: sampleEntry?.server.country.code ?? best?.countries[0]?.code ?? "DE",
                days: best?.defaultDurationDays ?? 7,
              }}
            />
          </div>
        </Container>
        <HeroWave className="absolute inset-x-0 -bottom-px" />
      </section>

      {/* Protocols */}
      <section id="protocols" className="relative isolate scroll-mt-24 pt-6 sm:pt-10" aria-labelledby="protocols-title">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-ocean-grid" />
        <Container>
          <SectionHeading
            id="protocols-title"
            eyebrow={
              <>
                <ServerIcon /> Services
              </>
            }
            title="Choose your protocol"
            description="Every protocol runs on our own servers. Pick one to see its locations, live status and free slots."
          />
          {protocols.length === 0 ? (
            <EmptyState
              icon={<ServerIcon />}
              title="Servers are on their way"
              description="No services are published right now. Please check back soon, or follow the server status page."
            >
              <Link href="/server-status" className="text-sm font-medium text-primary hover:underline">
                Open server status →
              </Link>
            </EmptyState>
          ) : (
            <ServiceCatalog protocols={protocols} />
          )}
        </Container>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mt-24 scroll-mt-24 sm:mt-32" aria-labelledby="how-title">
        <Container>
          <SectionHeading
            id="how-title"
            eyebrow={
              <>
                <SparklesIcon /> How it works
              </>
            }
            title="Three steps, about a minute"
            description="No sign-up, no email, no app from us. Just pick, create and connect."
          />
          <ol className="relative grid gap-5 md:grid-cols-3">
            <span aria-hidden className="absolute top-12 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-[1.75rem] border bg-card p-7 text-center shadow-[0_12px_32px_-20px_rgb(15_30_120/0.3)]">
                <span
                  className={
                    s.image
                      ? "relative mx-auto -my-1 block h-16 w-fit" // a picture instead of the blue tile; -my-1 keeps titles level
                      : "relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 [&_svg]:size-6"
                  }
                >
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small bundled picture
                    <img
                      src={s.image.src}
                      alt=""
                      aria-hidden="true"
                      width={s.image.width}
                      height={s.image.height}
                      draggable={false}
                      className="h-full w-auto object-contain"
                    />
                  ) : (
                    s.icon
                  )}
                  <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-card text-xs font-bold text-primary ring-1 ring-border tabular-nums">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Features */}
      <section className="mt-24 sm:mt-32" aria-labelledby="features-title">
        <Container>
          <SectionHeading id="features-title" title={`Why choose ${settings.siteName}`} />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                // Big flat icons: coloured fill with card-coloured details.
                icon: <SmartphoneIcon className="fill-yellow-400 text-yellow-400" />,
                title: "Instant setup",
                text: "Most accounts are ready a few seconds after you tap Create. No sign-up needed.",
              },
              {
                icon: <ZapIcon className="fill-violet-600 text-violet-600" />,
                title: "Fast servers",
                text:
                  countries > 1
                    ? `Servers in ${countries} countries. Pick the closest one or the one with the lowest ping.`
                    : "Pick the server closest to you or the one with the lowest ping right now.",
              },
              {
                icon: <ShieldCheckIcon className="fill-cyan-400 text-cyan-400" />,
                title: "Private and secure",
                text: "Your login details are shown to you once, then never stored on our side.",
              },
              {
                icon: <ServerIcon className="fill-rose-500 text-rose-500" />,
                title: "Always open",
                text: stats?.accountsTotal
                  ? `Create a free account any time, day or night. ${stats.accountsTotal.toLocaleString("en-US")} accounts created so far.`
                  : "Create a free account any time, day or night, weekends and holidays included.",
              },
            ].map((f) => (
              <li
                key={f.title}
                className="flex flex-col items-center rounded-[1.75rem] border border-border/60 bg-card px-6 pt-8 pb-9 text-center shadow-[0_12px_32px_-24px_rgb(15_30_120/0.35)] transition-transform duration-300 hover:-translate-y-1 motion-reduce:hover:translate-y-0 [&>svg]:size-14 [&>svg]:stroke-card [&>svg]:stroke-[1.75]"
              >
                {f.icon}
                <h3 className="mt-5 text-lg font-bold tracking-tight">{f.title}</h3>
                <p className="mt-2.5 text-[15px] leading-7 text-pretty text-muted-foreground">{f.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* DiceBear profiles */}
      <section className="mt-24 sm:mt-32" aria-labelledby="profiles-title">
        <Container>
          <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] border bg-gradient-to-br from-card to-accent/60 p-6 shadow-[0_20px_50px_-30px_rgb(15_30_120/0.35)] sm:p-10 lg:grid-cols-2">
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
                <UserRoundIcon className="size-3.5" /> Profiles
              </p>
              <h2 id="profiles-title" className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                Every account gets its own face
              </h2>
              <p className="mt-3 text-pretty text-muted-foreground">
                Each new account receives a unique avatar, drawn on our server the moment it is created. Your accounts on this device are listed under
                My accounts with their avatar, server and a live expiry countdown, so telling them apart takes a glance. No uploads, no third-party
                requests.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/my-accounts"
                  className="inline-flex h-11 items-center gap-2 rounded-full border bg-background px-5 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <UserRoundIcon className="size-4" />
                  My accounts
                </Link>
                <Link
                  href={primaryHref}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
                >
                  Create one now
                  <ArrowRightIcon className="size-4" />
                </Link>
              </div>
            </div>
            <div aria-hidden className="relative">
              <div className="absolute inset-0 -z-0 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]" />
              <ul className="relative grid grid-cols-4 gap-2 sm:gap-4">
                {profiles.map((p, i) => (
                  <li
                    key={p.seed}
                    className="flex min-w-0 animate-in flex-col items-center gap-2 rounded-2xl border bg-background/80 px-1 py-3 shadow-sm duration-500 fade-in fill-mode-both zoom-in-90 sm:p-3"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    {/* UserAvatar sizes itself inline; 52 px fits the narrowest (360 px) grid cell. */}
                    <UserAvatar src={p.src} size={52} />
                    <span className="max-w-full truncate text-[11px] font-medium text-muted-foreground">{p.seed}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* Live status strip */}
      <section className="mt-24 sm:mt-32" aria-labelledby="live-title">
        <Container>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
                <ActivityIcon className="size-3.5" /> Live now
              </p>
              <h2 id="live-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Servers right now
              </h2>
            </div>
            <Link href="/server-status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              Full server status
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          {live.length === 0 ? (
            <EmptyState icon={<ActivityIcon />} title="No live data yet" description="Server health appears here as soon as the first checks have run." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {live.map((e) => (
                <li key={`${e.protocol}-${e.server.id}`}>
                  <Link
                    href={e.server.availability === "available" ? e.server.href : "/server-status"}
                    className="group flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md motion-reduce:hover:translate-y-0"
                  >
                    <Flag code={e.server.country.code} squared className="size-10 rounded-xl" title={e.server.country.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{e.server.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ProtocolIcon name={e.protocolIcon} className="size-3" />
                        {e.protocol}
                        <span aria-hidden>·</span>
                        <Latency ms={e.server.latencyMs} />
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <AvailabilityBadge availability={e.server.availability} />
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {e.server.capacity.remaining === null ? "Open" : `${e.server.capacity.remaining} slots`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      {/* FAQ */}
      <section id="faq" className="mt-24 scroll-mt-24 sm:mt-32" aria-labelledby="faq-title">
        <Container className="max-w-3xl">
          <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered" description={`Accounts are valid for ${formatDays(allDays.length ? allDays : [3, 7, 30])}.`} />
          <Faq items={faq} />
        </Container>
      </section>

      {/* Final CTA */}
      <Container className="mt-24 sm:mt-32">
        <CtaBand title="Ready to connect?" description={`Free slots refill daily at ${resetText}. Grab yours while they last.`}>
          <Link href={primaryHref} className={heroPrimaryButton}>
            <KeyRoundIcon />
            Create free account
          </Link>
          <Link href="/server-status" className={heroSecondaryButton}>
            <ActivityIcon />
            Check server status
          </Link>
        </CtaBand>
      </Container>
    </>
  );
}
