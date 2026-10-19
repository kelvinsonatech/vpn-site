import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EyeOffIcon, FingerprintIcon, ShieldCheckIcon, TimerIcon } from "lucide-react";
import { LegalArticle, type ArticleSection } from "@/components/public/legal-article";
import { HeroChip, PageHeader } from "@/components/public/page-header";
import { mailtoHref, pageMetadata } from "@/lib/seo";
import { LEGAL_UPDATED, SHOW_REVIEW_NOTICE } from "@/app/(public)/_lib/legal";
import { loadSettings } from "@/app/(public)/_lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings();
  return pageMetadata({
    title: "Privacy policy",
    description: `What ${settings.siteName} stores when you create an account or report a problem, for how long, and what we never keep.`,
    path: "/privacy",
    siteName: settings.siteName,
  });
}

/** Result lifetime shown to visitors; mirrors PROVISION_RESULT_TTL_SECONDS (server-only env, default 1 h). */
function resultLifetime(): string {
  const seconds = Number(process.env.PROVISION_RESULT_TTL_SECONDS) || 3600;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`;
}

export default async function PrivacyPage() {
  await connection();
  const settings = await loadSettings();
  const name = settings.siteName;
  const email = mailtoHref(settings.contact.email);
  const lifetime = resultLifetime();

  const sections: ArticleSection[] = [
    {
      id: "summary",
      title: "The short version",
      body: (
        <ul>
          <li>No sign-up: we never ask for your name, email or phone number to create an account.</li>
          <li>
            Your password, keys and config files are shown to you <strong>once</strong>. We keep no copy of them.
          </li>
          <li>We never store raw IP addresses. Abuse protection uses a keyed hash that cannot be turned back into your address.</li>
          <li>No advertising, no analytics trackers and no third-party scripts (except the optional captcha described below).</li>
        </ul>
      ),
    },
    {
      id: "accounts",
      title: "When you create an account",
      body: (
        <>
          <p>To create and later remove your account we record:</p>
          <ul>
            <li>the protocol, the server and the validity you chose;</li>
            <li>the username (for SSH-type accounts) or an internal account identifier;</li>
            <li>when the account was created and when it expires;</li>
            <li>a keyed hash of your IP address, used only for rate limits and to stop mass account creation.</li>
          </ul>
          <p>
            The VPN server you picked needs your credentials so that you can log in. They exist there while your account is valid and are removed from
            the server when it expires or is revoked.
          </p>
        </>
      ),
    },
    {
      id: "one-time",
      title: "One-time delivery of your details",
      body: (
        <>
          <p>
            Right after creation, your connection details are encrypted and held for at most {lifetime}, so that your browser can fetch them (also after
            a reload). Only your browser holds the claim token that unlocks them. When that time runs out, the encrypted copy is erased for good.
          </p>
          <p>
            This is why we cannot show your password again or send it to you later. Copy it, scan the QR code or download the file before you leave the
            page.
          </p>
        </>
      ),
    },
    {
      id: "reports",
      title: "When you report a problem",
      body: (
        <p>
          The report form stores the server and protocol you selected, the category, your message, the email address if you choose to give one, and a
          keyed hash of your IP address (to limit spam). We use it only to investigate the problem and, if you left an address, to reply.
        </p>
      ),
    },
    {
      id: "tools",
      title: "When you use the tools",
      body: (
        <p>
          The <Link href="/tools">network tools</Link> look names and addresses up in public DNS from our server; the owner of an IP address comes from
          Team Cymru&apos;s public lookup service, which receives only the address being looked up. Check My IP shows the address your request came from
          and looks it up the same way; it isn&apos;t saved. The Domain Age Checker asks the domain&apos;s registry
          (over RDAP or WHOIS) for its public record; the registry receives only the domain name, and our server keeps the answer in memory for up to 30
          minutes. When you use Hostname to IP, we remember the hostname
          together with the public IP addresses it pointed to, so IP to Hostname can show which websites use an address. Anyone who looks up one of those
          addresses may then see the hostname, so don&apos;t use the tool for names you want to keep private. We never store who looked something up, and
          we never remember addresses on your own connection or dynamic-DNS and tunnel names (which usually point at someone&apos;s own device). A keyed
          hash of your IP is kept for a few minutes only, to limit how many lookups can be made.
        </p>
      ),
    },
    {
      id: "browser",
      title: "What stays in your browser",
      body: (
        <>
          <ul>
            <li>
              <strong>My accounts:</strong> a short, non-secret summary of the accounts you created on this device (protocol, server, username, avatar
              and expiry), kept in your browser&apos;s local storage. It never contains passwords, keys, links or configs, and you can clear it at any time
              on the <Link href="/my-accounts">My accounts</Link> page.
            </li>
            <li>Your light or dark theme choice, and whether you dismissed the announcement bar for this session.</li>
          </ul>
          <p>We do not use tracking or advertising cookies.</p>
        </>
      ),
    },
    {
      id: "captcha",
      title: "Captcha",
      body: (
        <p>
          When the captcha is switched on, the account and report forms load Cloudflare Turnstile to tell people from bots. Cloudflare then processes
          technical data such as your IP address under its own privacy policy. It is the only third-party service your browser is sent to by our site.
        </p>
      ),
    },
    {
      id: "traffic",
      title: "Your traffic",
      body: (
        <p>
          We do not record which websites you visit or what you send through our servers. Servers collect only what they need to run: for example
          whether an account is active and basic health figures such as CPU load and uptime.
        </p>
      ),
    },
    {
      id: "retention",
      title: "How long we keep things",
      body: (
        <ul>
          <li>Encrypted one-time results: at most {lifetime}.</li>
          <li>Account records (without any credentials): kept after the account expires, for statistics and abuse prevention.</li>
          <li>Problem reports: kept while we look into them, then deleted automatically 90 days after they are resolved (sooner on request).</li>
          <li>Server health history (no personal data): 7 days.</li>
          <li>Hostnames looked up with the tools and the IPs they pointed to: deleted 90 days after they were last looked up, or sooner once they stop pointing there.</li>
        </ul>
      ),
    },
    {
      id: "choices",
      title: "Your choices",
      body: (
        <p>
          You can clear the My accounts list in your browser at any time. To have a report you sent deleted, or for any other privacy question,{" "}
          {email ? (
            <>
              email us at <a href={email}>{settings.contact.email}</a>
            </>
          ) : (
            <>
              contact us through the <Link href="/contact">contact page</Link>
            </>
          )}
          . Because we never ask who you are, we may not be able to link an account to you.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          If we change what we collect, we will update this page and the date at the top. Using {name} after a change means you accept the updated
          policy.
        </p>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Privacy policy", href: "/privacy" },
        ]}
        icon={<ShieldCheckIcon />}
        eyebrow="Legal"
        title="Privacy policy"
        description={`What ${name} stores, why, and for how long. Written to be read, not skimmed past.`}
      >
        <HeroChip icon={<EyeOffIcon />}>Details shown once</HeroChip>
        <HeroChip icon={<FingerprintIcon />}>No raw IPs</HeroChip>
        <HeroChip icon={<TimerIcon />}>Short retention</HeroChip>
      </PageHeader>
      <LegalArticle sections={sections} updated={LEGAL_UPDATED} reviewNotice={SHOW_REVIEW_NOTICE} />
    </>
  );
}
