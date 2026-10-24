import { headers } from "next/headers";
import { ADSENSE_SCRIPT_URL, adsenseClientId } from "@/lib/adsense";

/**
 * Google AdSense Auto ads, when ADSENSE_CLIENT_ID is set. Each content page renders it, not the
 * public layout, so the 404 and error screens never load ads: Google allows no ads on screens
 * without publisher content. React moves the tag into <head> and loads it once per document.
 */
export async function AdsenseScript() {
  const client = adsenseClientId();
  if (!client) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script async src={`${ADSENSE_SCRIPT_URL}?client=${client}`} crossOrigin="anonymous" nonce={nonce} />;
}
