import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { absoluteUrl, siteOrigin } from "@/lib/seo";

/**
 * /robots.txt: the public site is crawlable; the admin panel and the JSON APIs are not. Rendered per
 * request (like the sitemap): built ahead of time it would carry the build's APP_URL, which a Docker
 * build does not have, so it named http://localhost:3000.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteOrigin(),
  };
}
