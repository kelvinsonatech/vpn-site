/**
 * Google AdSense (optional). Set ADSENSE_CLIENT_ID in .env to your publisher ID (ca-pub-… or pub-…,
 * 16 digits) to load AdSense Auto ads on public pages, serve /ads.txt and open the Content-Security-
 * Policy that Google's ad code needs on those pages. Admin pages never load ads. Read straight from
 * process.env so the proxy can use it without the full environment configuration.
 */
const PUBLISHER = /^(?:ca-)?pub-(\d{16})$/;

/** The client ID for the ad tag ("ca-pub-…"), or null when AdSense is off or the value is malformed. */
export function adsenseClientId(raw: string | undefined = process.env.ADSENSE_CLIENT_ID): string | null {
  const m = raw?.trim().match(PUBLISHER);
  return m ? `ca-pub-${m[1]}` : null;
}

export function isValidAdsenseClientId(raw: string): boolean {
  return PUBLISHER.test(raw.trim());
}

export const ADSENSE_SCRIPT_URL = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

/** Google's line for /ads.txt: the publisher ID without "ca-", and Google's certification authority ID. */
export function adsTxt(client: string): string {
  return `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`;
}
