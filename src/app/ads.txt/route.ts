import { connection } from "next/server";
import { adsTxt, adsenseClientId } from "@/lib/adsense";

/** /ads.txt: authorises Google to sell ads on this site (only when ADSENSE_CLIENT_ID is set). */
export async function GET() {
  await connection();
  const client = adsenseClientId();
  if (!client) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(adsTxt(client), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
