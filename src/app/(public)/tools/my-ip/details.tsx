import Link from "next/link";
import { ArrowRightIcon, ShieldCheckIcon, ShieldIcon } from "lucide-react";
import { countryName } from "@/lib/countries";
import { rateLimit } from "@/server/auth/rate-limit";
import { myIpDetails, type ServerMatch } from "@/server/tools/my-ip";
import { Flag } from "@/components/public/flag";

/** Page views per client network per 5 minutes that also run the DNS lookups (the address and server match always show). */
const LIMIT = 30;
const WINDOW_SECONDS = 300;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-start gap-3 px-4 py-2.5">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const startLinkClass =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 max-sm:ml-8";

/**
 * Whether the visitor is browsing through one of our servers. "Not one of ours" is only said when it is
 * certain; over the IP family a server isn't listed by, the note says the check can't tell.
 */
function ConnectionStatus({ match, v6, siteName }: { match: ServerMatch; v6: boolean; siteName: string }) {
  if (match.server) {
    const [first, ...others] = match.server.name.split(" ");
    const rest = others.join(" ");
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-sm">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <p className="min-w-0 [overflow-wrap:anywhere]">
          <strong className="font-semibold">You&apos;re browsing through {siteName}.</strong> This is the address of our{" "}
          {/* The flag stays with the name's first word; a long name still wraps after it. */}
          <span className="font-medium whitespace-nowrap">
            <Flag code={match.server.countryCode} className="mr-1.5 inline-block h-3 w-4 align-[-1px]" />
            {first}
          </span>
          {rest ? <span className="font-medium"> {rest}</span> : null} server, so websites see it instead of your own.
        </p>
      </div>
    );
  }
  const [mine, other] = v6 ? ["IPv6", "IPv4"] : ["IPv4", "IPv6"];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
      {/* Icon and text stay together; on phones the button wraps under them, lined up with the text. */}
      <div className="flex min-w-0 flex-1 basis-52 items-start gap-3">
        <ShieldIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        {match.certain ? (
          <p className="min-w-0">
            <strong className="font-semibold">Not a {siteName} server address.</strong> Websites and apps you use can see this address.
          </p>
        ) : (
          <p className="min-w-0">
            <strong className="font-semibold">
              Can&apos;t confirm a {siteName} connection over {mine}.
            </strong>{" "}
            {match.anyInFamily ? `Some of our servers are listed only by their ${other} address` : `Our servers are listed by their ${other} address`}, so a
            tunnel through them is only recognised when you reach us over {other}.
          </p>
        )}
      </div>
      <Link href="/#protocols" className={startLinkClass}>
        Get a free tunnel
        <ArrowRightIcon className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

/** Placeholder while the DNS lookups run (streamed in behind the address). */
export function MyIpDetailsSkeleton() {
  return (
    <div className="grid gap-5" role="status">
      <span className="sr-only">Looking up your hostname and network…</span>
      <div aria-hidden className="h-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div aria-hidden className="h-56 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}

/**
 * The slower part of "Check My IP": whether the address is one of our servers (always checked: everyone
 * browsing through one server shares its address), and its reverse DNS name and network (DNS lookups,
 * rate limited per client network). `clientKey` is the hashed client network.
 */
export async function MyIpDetailsPanel({ ip, clientKey, siteName }: { ip: string; clientKey: string | null; siteName: string }) {
  const limit = await rateLimit(`tools:my-ip:${clientKey ?? "unknown"}`, LIMIT, WINDOW_SECONDS, "open");
  const { match, dns } = await myIpDetails(ip, limit.allowed);
  const network = dns?.network;
  return (
    <>
      {match ? <ConnectionStatus match={match} v6={ip.includes(":")} siteName={siteName} /> : null}
      {dns ? (
        <dl className="divide-y overflow-hidden rounded-2xl border bg-muted/30 text-sm">
          <Row label="Hostname">
            {dns.hostnames.length ? (
              <span className="grid gap-0.5 font-mono text-[13px]">
                {dns.hostnames.slice(0, 3).map((h) => (
                  <span key={h.name}>{h.name}</span>
                ))}
              </span>
            ) : (
              <span className="font-normal text-muted-foreground">{dns.reverseDnsFailed ? "Couldn't look it up right now" : "None set"}</span>
            )}
          </Row>
          <Row label="Provider">{network?.name || <span className="font-normal text-muted-foreground">Unknown</span>}</Row>
          {network ? (
            <>
              <Row label="ASN">
                <span className="font-mono">AS{network.asn}</span>
              </Row>
              {network.country ? (
                <Row label="Country">
                  <span className="inline-flex items-center gap-1.5">
                    <Flag code={network.country} className="h-3 w-4" />
                    {countryName(network.country)}
                  </span>
                </Row>
              ) : null}
              <Row label="IP range">
                <span className="font-mono">{network.prefix}</span>
              </Row>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          You&apos;ve checked a lot in a short time, so the hostname and network details are paused for a few minutes. The address above is always current.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        <Link href={`/tools/ip-to-hostname?ip=${encodeURIComponent(ip)}`} className="font-medium text-primary underline-offset-2 hover:underline">
          Open this address in IP to Hostname
        </Link>{" "}
        to see any websites that use it.
      </p>
    </>
  );
}
