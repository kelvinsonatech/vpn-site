import type { StaticImageData } from "next/image";
import chooseAProtocol from "@/assets/guides/choose-a-protocol.webp";
import chooseAProtocolCard from "@/assets/guides/choose-a-protocol-card.webp";
import chooseAServerLocation from "@/assets/guides/choose-a-server-location.webp";
import chooseAServerLocationCard from "@/assets/guides/choose-a-server-location-card.webp";
import dnsttSlowdnsFastdnsExplained from "@/assets/guides/dnstt-slowdns-fastdns-explained.webp";
import dnsttSlowdnsFastdnsExplainedCard from "@/assets/guides/dnstt-slowdns-fastdns-explained-card.webp";
import fixConnectionProblems from "@/assets/guides/fix-connection-problems.webp";
import fixConnectionProblemsCard from "@/assets/guides/fix-connection-problems-card.webp";
import freeAccountsFairUse from "@/assets/guides/free-accounts-fair-use.webp";
import freeAccountsFairUseCard from "@/assets/guides/free-accounts-fair-use-card.webp";
import httpCustomSshSetup from "@/assets/guides/http-custom-ssh-setup.webp";
import httpCustomSshSetupCard from "@/assets/guides/http-custom-ssh-setup-card.webp";
import hysteria2ZivpnUdpExplained from "@/assets/guides/hysteria2-zivpn-udp-explained.webp";
import hysteria2ZivpnUdpExplainedCard from "@/assets/guides/hysteria2-zivpn-udp-explained-card.webp";
import importV2rayLinks from "@/assets/guides/import-v2ray-links.webp";
import importV2rayLinksCard from "@/assets/guides/import-v2ray-links-card.webp";
import npvTunnelSetup from "@/assets/guides/npv-tunnel-setup.webp";
import npvTunnelSetupCard from "@/assets/guides/npv-tunnel-setup-card.webp";
import privacyBasics from "@/assets/guides/privacy-basics.webp";
import privacyBasicsCard from "@/assets/guides/privacy-basics-card.webp";
import sshSslExplained from "@/assets/guides/ssh-ssl-explained.webp";
import sshSslExplainedCard from "@/assets/guides/ssh-ssl-explained-card.webp";
import vmessVlessTrojanExplained from "@/assets/guides/vmess-vless-trojan-explained.webp";
import vmessVlessTrojanExplainedCard from "@/assets/guides/vmess-vless-trojan-explained-card.webp";
import whatIsSshTunneling from "@/assets/guides/what-is-ssh-tunneling.webp";
import whatIsSshTunnelingCard from "@/assets/guides/what-is-ssh-tunneling-card.webp";

/**
 * Cover photo of each guide, from Pexels (free for commercial use under the Pexels licence, no
 * attribution required; the article still credits the photographer). Two sizes, cropped to 16:9.
 */
export interface GuideCover {
  /** 1600×900: article photo and share preview. */
  full: StaticImageData;
  /** 800×450: guide cards. */
  card: StaticImageData;
  /** What the photo shows: the article photo's alt text (cards are labelled by the guide title). */
  alt: string;
  /** Credited under the article photo ("" = credit Pexels only). */
  photographer: string;
  /** The photo's page on Pexels. */
  href: string;
}

const COVERS: Record<string, GuideCover> = {
  "choose-a-protocol": {
    full: chooseAProtocol,
    card: chooseAProtocolCard,
    alt: "Red, yellow, green, blue and black cables crossing over each other on a dark surface",
    photographer: "Antonio Avanti",
    href: "https://www.pexels.com/photo/close-up-of-cables-17072947/",
  },
  "choose-a-server-location": {
    full: chooseAServerLocation,
    card: chooseAServerLocationCard,
    alt: "Colourful push pins marking places on a map of northern Europe in soft sunlight",
    photographer: "Lara Jameson",
    href: "https://www.pexels.com/photo/close-up-og-pins-in-a-world-map-8828584/",
  },
  "dnstt-slowdns-fastdns-explained": {
    full: dnsttSlowdnsFastdnsExplained,
    card: dnsttSlowdnsFastdnsExplainedCard,
    alt: "Silver tower server with a perforated front panel in a blue-lit server room",
    photographer: "panumas nikhomkhai",
    href: "https://www.pexels.com/photo/computer-server-in-data-center-room-17489163/",
  },
  "fix-connection-problems": {
    full: fixConnectionProblems,
    card: fixConnectionProblemsCard,
    alt: "Close-up of a blue network cable with a clear RJ45 plug on a plain white background",
    photographer: "Pixabay",
    href: "https://www.pexels.com/photo/blue-ethernet-cable-415043/",
  },
  "free-accounts-fair-use": {
    full: freeAccountsFairUse,
    card: freeAccountsFairUseCard,
    alt: "White desk clock beside a pen and a notebook with a white smartphone on a clean white desk",
    photographer: "freestocks.org",
    href: "https://www.pexels.com/photo/square-white-analog-desk-c-lock-364671/",
  },
  "http-custom-ssh-setup": {
    full: httpCustomSshSetup,
    card: httpCustomSshSetupCard,
    alt: "Close-up of a hand holding a smartphone with an in-screen fingerprint sensor on the lock screen",
    photographer: "I'm Zion",
    href: "https://www.pexels.com/photo/a-person-holding-a-mobile-phone-12376016/",
  },
  "hysteria2-zivpn-udp-explained": {
    full: hysteria2ZivpnUdpExplained,
    card: hysteria2ZivpnUdpExplainedCard,
    alt: "Mobile phone mast covered in white antenna panels against a clear blue sky",
    photographer: "Edvin G\u00e1l",
    href: "https://www.pexels.com/photo/cell-tower-against-clear-blue-sky-36178997/",
  },
  "import-v2ray-links": {
    full: importV2rayLinks,
    card: importV2rayLinksCard,
    alt: "Smartphone with a blank screen lying beside an open laptop on a sunlit wooden desk",
    photographer: "Jakub Zerdzicki",
    href: "https://www.pexels.com/photo/modern-office-workspace-with-laptop-and-smartphone-34170828/",
  },
  "npv-tunnel-setup": {
    full: npvTunnelSetup,
    card: npvTunnelSetupCard,
    alt: "Close-up of a person in a white top holding two smartphones, one in each hand",
    photographer: "Kaboompics.com",
    href: "https://www.pexels.com/photo/close-up-view-of-person-holding-two-cellphones-5398933/",
  },
  "privacy-basics": {
    full: privacyBasics,
    card: privacyBasicsCard,
    alt: "Traveller holding a phone in an airport lounge, feet on a suitcase, watching a plane take off",
    photographer: "JESHOOTS.com",
    href: "https://www.pexels.com/photo/man-in-airport-waiting-for-boarding-on-plane-1201995/",
  },
  "ssh-ssl-explained": {
    full: sshSslExplained,
    card: sshSslExplainedCard,
    alt: "Key with a black handle in the lock of an open wooden door, green garden blurred behind",
    photographer: "AS Photography",
    href: "https://www.pexels.com/photo/black-handled-key-on-key-hole-101808/",
  },
  "vmess-vless-trojan-explained": {
    full: vmessVlessTrojanExplained,
    card: vmessVlessTrojanExplainedCard,
    alt: "Aerial night view of a multi-level highway interchange with looping ramps and light trails",
    photographer: "\u9694\u58c1\u5149\u5934\u8001\u738b WangMing'Photo",
    href: "https://www.pexels.com/photo/viaducts-and-roundabout-at-night-18048834/",
  },
  "what-is-ssh-tunneling": {
    full: whatIsSshTunneling,
    card: whatIsSshTunnelingCard,
    alt: "Concrete tunnel lined with warm white LED frames that spiral toward a bright opening, reflected in still water",
    photographer: "Liuuu _61",
    href: "https://www.pexels.com/photo/futuristic-tunnel-with-geometric-led-patterns-35430498/",
  },
};

export function guideCover(slug: string): GuideCover | undefined {
  return COVERS[slug];
}
