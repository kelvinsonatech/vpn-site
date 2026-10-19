import Link from "next/link";
import { ArrowRightIcon, ShieldCheckIcon, ShieldIcon } from "lucide-react";
import { countryName } from "@/lib/countries";
import { rateLimit } from "@/server/auth/rate-limit";
import { myIpDetails, type OurServer } from "@/server/tools/my-ip";
import { Flag } from "@/components/public/flag";

/** Page views per client network per 5 minutes that also run the DNS lookups (the address itself always shows). */
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

/** Whether the visitor is browsing through one of our servers, with a way to start when they aren't. */
function ConnectionStatus({ server, siteName }: { server: OurServer | null; siteName: string }) {
  if (server) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-sm">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <p className="min-w-0">
          <strong className="font-semibold">You&apos;re browsing through {siteName}.</strong> This is the address of our{" "}
          <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap">
            <Flag code={server.countryCode} className="h-3 w-4" />
            {server.name}
          </span>{" "}
          server, so websites see it instead of your own.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
      <ShieldIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      {/* The text keeps a readable width; on phones the button wraps under it, lined up with the text. */}
      <p className="min-w-0 flex-1 basis-52">
        <strong className="font-semibold">Not a {siteName} server address.</strong> Websites and apps you use can see this address.
      </p>
      <Link
        href="/#protocols"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 max-sm:ml-8"
      >
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
 * The slower part of "Check My IP": whether the address is one of our servers, its reverse DNS name
 * and the network it belongs to. `clientKey` is the hashed client network, for the rate limit.
 */
export async function MyIpDetailsPanel({ ip, clientKey, siteName }: { ip: string; clientKey: string | null; siteName: string }) {
  const limit = await rateLimit(`tools:my-ip:${clientKey ?? "unknown"}`, LIMIT, WINDOW_SECONDS, "open");
  if (!limit.allowed) {
    return (
      <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        You&apos;ve checked a lot in a short time, so the hostname and network details are paused for a few minutes. The address above is always current.
      </p>
    );
  }
  const d = await myIpDetails(ip);
  const network = d.network;
  return (
    <>
      <ConnectionStatus server={d.server} siteName={siteName} />
      <dl className="divide-y overflow-hidden rounded-2xl border bg-muted/30 text-sm">
        <Row label="Hostname">
          {d.hostnames.length ? (
            <span className="grid gap-0.5 font-mono text-[13px]">
              {d.hostnames.slice(0, 3).map((h) => (
                <span key={h.name}>{h.name}</span>
              ))}
            </span>
          ) : (
            <span className="font-normal text-muted-foreground">{d.reverseDnsFailed ? "Couldn't look it up right now" : "None set"}</span>
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
      <p className="text-sm text-muted-foreground">
        <Link href={`/tools/ip-to-hostname?ip=${encodeURIComponent(ip)}`} className="font-medium text-primary underline-offset-2 hover:underline">
          Open this address in IP to Hostname
        </Link>{" "}
        to see any websites that use it.
      </p>
    </>
  );
}
