import type { GuideArticle, GuideCategory } from "./types";
import { article as whatIsSshTunneling } from "./articles/what-is-ssh-tunneling";
import { article as chooseAProtocol } from "./articles/choose-a-protocol";
import { article as chooseAServerLocation } from "./articles/choose-a-server-location";
import { article as httpCustomSshSetup } from "./articles/http-custom-ssh-setup";
import { article as npvTunnelSetup } from "./articles/npv-tunnel-setup";
import { article as importV2rayLinks } from "./articles/import-v2ray-links";
import { article as sshSslExplained } from "./articles/ssh-ssl-explained";
import { article as dnsttExplained } from "./articles/dnstt-slowdns-fastdns-explained";
import { article as v2rayProtocolsExplained } from "./articles/vmess-vless-trojan-explained";
import { article as udpProtocolsExplained } from "./articles/hysteria2-zivpn-udp-explained";
import { article as fixConnectionProblems } from "./articles/fix-connection-problems";
import { article as privacyBasics } from "./articles/privacy-basics";
import { article as freeAccountsFairUse } from "./articles/free-accounts-fair-use";

export type { GuideArticle, GuideBlock, GuideCategory, GuideSection } from "./types";

/** Display order of the categories on /guides. */
export const GUIDE_CATEGORIES: GuideCategory[] = ["Getting started", "Apps", "Protocols", "Troubleshooting", "Privacy & fair use"];

/** Every guide, in reading order within its category. */
export const GUIDES: GuideArticle[] = [
  whatIsSshTunneling,
  chooseAProtocol,
  chooseAServerLocation,
  httpCustomSshSetup,
  npvTunnelSetup,
  importV2rayLinks,
  sshSslExplained,
  dnsttExplained,
  v2rayProtocolsExplained,
  udpProtocolsExplained,
  fixConnectionProblems,
  privacyBasics,
  freeAccountsFairUse,
];

export function getGuide(slug: string): GuideArticle | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Guides about a protocol (for links from that protocol's page). */
export function guidesForProtocol(slug: string): GuideArticle[] {
  return GUIDES.filter((g) => g.protocols.includes(slug));
}

/** Plain text of an inline-marked string: **bold** and [label](/path) become their text. */
export function plainText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\(\/(?!\/)[^)\s]*\)/g, "$1");
}

/** All the words of a guide (for reading time and checks). */
export function guideText(g: GuideArticle): string {
  const blocks = g.sections.flatMap((s) => [
    s.heading,
    ...s.blocks.flatMap((b) => (b.type === "p" || b.type === "tip" || b.type === "note" ? [b.text] : b.type === "table" ? b.rows.flat() : b.items)),
  ]);
  return plainText([g.title, ...g.intro, ...blocks, ...(g.faq ?? []).flatMap((f) => [f.q, f.a])].join(" "));
}

/** Reading time at about 200 words a minute. */
export function readingMinutes(g: GuideArticle): number {
  return Math.max(1, Math.round(guideText(g).split(/\s+/).filter(Boolean).length / 200));
}
