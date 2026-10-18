/** Second-level labels used under country codes ("example.co.uk", "site.com.ng"). */
const SECOND_LEVEL = new Set(["co", "com", "net", "org", "gov", "edu", "ac", "or", "ne", "go", "sch", "mil", "nic"]);

/**
 * "www.example.co.uk" → "example.co.uk", "a.b.example.com" → "example.com". A short heuristic, not
 * the Public Suffix List: close enough for per-domain caps, and Domain Age retries one label longer
 * when a registry doesn't know the guess.
 */
export function registrableDomain(hostname: string): string {
  const labels = hostname.split(".");
  const take = labels.length >= 3 && labels.at(-1)!.length === 2 && SECOND_LEVEL.has(labels.at(-2)!) ? 3 : 2;
  return labels.slice(-take).join(".");
}
