import { afterEach, describe, expect, it, vi } from "vitest";
import { adsTxt, adsenseClientId, isValidAdsenseClientId } from "@/lib/adsense";
import { GET as adsTxtRoute } from "@/app/ads.txt/route";

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));

describe("AdSense settings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the publisher ID with or without ca-, and nothing else", () => {
    expect(adsenseClientId("ca-pub-1234567890123456")).toBe("ca-pub-1234567890123456");
    expect(adsenseClientId(" pub-1234567890123456 ")).toBe("ca-pub-1234567890123456");
    for (const bad of [undefined, "", "pub-123", "ca-pub-12345678901234567", "ca-pub-123456789012345a", "https://example.com"])
      expect(adsenseClientId(bad), String(bad)).toBeNull();
    expect(isValidAdsenseClientId("pub-1234567890123456")).toBe(true);
    expect(isValidAdsenseClientId("1234567890123456")).toBe(false);
  });

  it("writes Google's ads.txt line", () => {
    expect(adsTxt("ca-pub-1234567890123456")).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  });

  it("serves /ads.txt only while AdSense is set up", async () => {
    vi.stubEnv("ADSENSE_CLIENT_ID", "");
    expect((await adsTxtRoute()).status).toBe(404);
    vi.stubEnv("ADSENSE_CLIENT_ID", "pub-1234567890123456");
    const res = await adsTxtRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  });
});
