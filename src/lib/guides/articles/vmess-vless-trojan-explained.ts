import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "vmess-vless-trojan-explained",
  title: "VMess, VLESS and Trojan explained: how they differ",
  description:
    "How VMess, VLESS and Trojan differ: encryption, TLS, WebSocket and gRPC, UUIDs and passwords, what a share link holds, and which one to choose.",
  category: "Protocols",
  updated: "2026-10-24",
  intro: [
    'VMess, VLESS and Trojan are three protocols from one family. They run on Xray, an open-source proxy platform that grew out of the V2Ray project, which is why apps often call them all "V2Ray". On this site, an account for any of them comes with its details and one or more **share links**, each with a QR code. Which protocols are offered at any time is shown in the [list of services](/#protocols) on the home page.',
    "This guide explains how each one protects your traffic, what the settings on your account mean, and how to choose. For step-by-step import instructions, see [Import VMess, VLESS and Trojan links](/guides/import-v2ray-links).",
  ],
  sections: [
    {
      heading: "Three layers: protocol, transport and security",
      blocks: [
        {
          type: "p",
          text: "It helps to think of every connection in this family as three layers stacked on top of each other. Your app and the server must agree on all three, or nothing gets through.",
        },
        {
          type: "ul",
          items: [
            "**The protocol** (VMess, VLESS or Trojan): how your app proves which account it belongs to and where your traffic should go.",
            "**The transport** (WebSocket or gRPC): how that conversation is carried across the internet.",
            "**The security layer** (TLS, or none): whether everything is wrapped in the encryption HTTPS websites use.",
          ],
        },
        {
          type: "p",
          text: "The three protocols differ mainly in the first layer and share the other two, so one app handles all of them, and a share link carries every setting in one line.",
        },
      ],
    },
    {
      heading: "VMess: the original, with its own encryption",
      blocks: [
        {
          type: "p",
          text: 'VMess is the protocol V2Ray started with. Your account is identified by a **UUID**, a long random ID that works like a password. The app uses it to prove who it is, and VMess then encrypts the traffic itself. The links here set the cipher to "auto", which picks a modern one that suits your device.',
        },
        {
          type: "p",
          text: "So VMess traffic stays encrypted even on a link without TLS. TLS still matters: the server's certificate proves that you reached the real server.",
        },
        {
          type: "ul",
          items: [
            "**It checks the time.** Every connection carries a timestamp, and the server rejects clocks that are too far off. If your device's clock is wrong by more than a minute or two, VMess fails while other protocols still work. Turn on automatic date and time.",
            "**Alter ID** is a setting from older versions; modern VMess uses 0. The link sets it for you.",
          ],
        },
      ],
    },
    {
      heading: "VLESS: lighter, and relies on TLS",
      blocks: [
        {
          type: "p",
          text: "VLESS is a newer, simpler design. It also identifies your account with a UUID, but in the usual setup it adds no encryption of its own: the vless:// links here even contain the setting encryption=none. After the UUID check it passes your data through with very little extra work. It sends no timestamp either, so a clock that is a few minutes off does not break it.",
        },
        {
          type: "p",
          text: "That is why VLESS is called lighter: fewer extra bytes and less work for your processor, which is welcome on an older phone.",
        },
        {
          type: "note",
          text: "With encryption=none, VLESS does not encrypt anything by itself, so always use a TLS link with it. Without TLS, only data that was already encrypted, such as HTTPS websites, would stay private.",
        },
      ],
    },
    {
      heading: "Trojan: a password inside HTTPS",
      blocks: [
        {
          type: "p",
          text: "Trojan adds no encryption of its own either. It was designed to sit inside an ordinary TLS connection, the kind your browser opens to any HTTPS website. Your app connects with TLS, then sends a hash of your account's **password** (a scrambled fingerprint of it, not the password itself), followed by your traffic.",
        },
        {
          type: "p",
          text: "If a connection does not carry the right password, the server can answer it the way an ordinary website would. For you, the result is privacy: anyone watching the local network, such as other people on a public Wi-Fi, sees an encrypted HTTPS-style connection, not what you do inside it.",
        },
        {
          type: "p",
          text: "Without TLS, Trojan would send everything unencrypted, so always use a TLS link with it. Its password, like a UUID, comes inside the share link, so you never type it.",
        },
      ],
    },
    {
      heading: "TLS, WebSocket and gRPC",
      blocks: [
        {
          type: "p",
          text: "**TLS** is the encryption behind HTTPS. It encrypts the connection and checks the server's certificate, so your app knows it reached the real server. TLS links normally use port 443. The **SNI** on your account is the server name your app sends at the start of the TLS handshake so the server presents the right certificate. Keep it as the server's own host, the Domain on your account.",
        },
        {
          type: "tip",
          text: "The create form has an optional **Custom SNI / host** field. Leave it empty: it only changes the links you receive, and the normal links already name your server correctly. If your app has an option to allow insecure connections, leave that off too: it removes the check that you reached the real server.",
        },
        {
          type: "p",
          text: "**WebSocket** starts as an ordinary web request and then becomes a two-way channel. Every app in this guide supports it. It uses a **path**, a short part of the address such as /something, which must match the server exactly.",
        },
        {
          type: "p",
          text: "**gRPC** runs over HTTP/2, which can carry several streams over one connection. It uses a **service name** instead of a path.",
        },
        {
          type: "p",
          text: "The create form normally asks which transport you want, with WebSocket selected first. The result may then hold several links, such as TLS and non-TLS: start with the TLS link.",
        },
      ],
    },
    {
      heading: "What a share link contains",
      blocks: [
        {
          type: "p",
          text: "**Account details** on the result page lists each setting: the Domain, a Remark (the name you chose, used as the profile name), the UUID or Password, the Alter ID (VMess only), the TLS and non-TLS ports, the network, the path or gRPC service name, and the SNI. Under **Quick import**, share links pack the same values into one line:",
        },
        {
          type: "ul",
          items: [
            "**vmess://** followed by a long block of letters and digits: the settings encoded in base64, a way of writing data as plain text.",
            "**vless://** followed by the UUID, an @ sign, the domain and port, then settings such as type=ws, security=tls, the path and the SNI, and finally a # sign and the remark.",
            "**trojan://** in the same shape, with your password in place of the UUID.",
          ],
        },
        {
          type: "p",
          text: "A UUID is written as 32 hexadecimal characters (the digits 0 to 9 and the letters a to f) in five groups separated by hyphens. To see everything a link holds, paste it into [V2Ray to JSON](/tools/v2ray-to-json). It decodes the link in your browser without sending it anywhere.",
        },
        {
          type: "note",
          text: "The UUID or password in the link is the key to your account, so treat the link and its QR code like a password. Use each account on one device: one used on several can be banned for multi-login, shown as **Banned** on [My accounts](/my-accounts). Details are shown only once, so save them before leaving the page.",
        },
      ],
    },
    {
      heading: "Side by side, and which to choose",
      blocks: [
        {
          type: "table",
          rows: [
            ["Feature", "VMess", "VLESS", "Trojan"],
            ["Account key", "UUID", "UUID", "Password"],
            ["Own encryption", "Yes", "No, relies on TLS", "No, relies on TLS"],
            ["TLS", "Recommended", "Always use it", "Designed for it"],
            ["Strict clock check", "Yes", "No", "No"],
            ["Extra work per packet", "More", "Very little", "Very little"],
            ["Link starts with", "vmess://", "vless://", "trojan://"],
          ],
        },
        {
          type: "ul",
          items: [
            "**Not sure? Start with VLESS on a TLS link over WebSocket.** It is light, ignores small clock errors and works in every app listed in the questions below.",
            "**Choose VMess** if your app or an existing config only supports VMess, and keep your device's clock set automatically.",
            "**Choose Trojan** if you prefer a password to a UUID. It is as light as VLESS and also needs TLS.",
            "**Connection drops often over WebSocket?** Try an account with the gRPC transport and compare.",
          ],
        },
        {
          type: "p",
          text: "On a good line the three feel much the same; the distance to the server and your own connection matter more (see [Choose a server location](/guides/choose-a-server-location)). Whichever you pick, follow your network's terms and the law, and keep to our [acceptable use policy](/acceptable-use).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Is VMess more secure than VLESS because it has its own encryption?",
      a: "Not when both use TLS. TLS already encrypts the connection and checks the server, so the extra VMess layer adds work but little real protection. It only matters on a non-TLS link, which is why TLS links are the ones to use.",
    },
    {
      q: "Which apps work with all three?",
      a: "On Android: v2rayNG, NekoBox and Hiddify. On iPhone and iPad: Shadowrocket (paid), Streisand and V2Box. On Windows: v2rayN, Hiddify and Clash Verge Rev. On macOS: Hiddify and Clash Verge Rev. On Linux: Hiddify, or sing-box on the command line. The [import guide](/guides/import-v2ray-links) covers the common ones.",
    },
    {
      q: "Can I switch protocol or transport on the same account?",
      a: "No. Each account is created for one protocol on one server, with the transport you chose on the form. To try another combination, create an account for it.",
    },
  ],
  related: ["import-v2ray-links", "choose-a-protocol", "fix-connection-problems"],
  protocols: ["vmess", "vless", "trojan"],
};
