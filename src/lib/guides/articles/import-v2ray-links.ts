import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "import-v2ray-links",
  title: "Import VMess, VLESS and Trojan links into V2Ray apps",
  description:
    "Import vmess://, vless:// and trojan:// links or QR codes into v2rayNG, v2rayN and iPhone apps, make JSON configs, test the tunnel and keep links private.",
  category: "Apps",
  updated: "2026-10-24",
  intro: [
    "When you create a VMess, VLESS or Trojan account on this site, the result gives you one or more **share links** and a QR code for each. A share link packs every setting your app needs into one line of text, so importing it takes seconds and avoids typing mistakes.",
    "This guide shows how to import those links on Android, Windows and iPhone, when the [V2Ray to JSON](/tools/v2ray-to-json) tool is useful, how to check that the tunnel works and why a link deserves the same care as a password.",
  ],
  sections: [
    {
      heading: "What is inside a share link",
      blocks: [
        {
          type: "p",
          text: "A share link is the whole account written as text. A **vmess://** link is a small block of settings encoded in base64. **vless://** and **trojan://** links look more like web addresses: the user ID or password, the server and port, followed by settings such as the transport (WebSocket or gRPC), the path, whether TLS is used and the SNI.",
        },
        {
          type: "p",
          text: "On the result page the links are under **Quick import**. Each has a copy button and a QR code button, and a label telling you which connection it is. If you see several links, they are the same account over different connections, for example WebSocket with TLS, plain WebSocket or gRPC.",
        },
        {
          type: "tip",
          text: "Start with a TLS link. With VLESS, always use a TLS link: VLESS does not encrypt anything itself and relies on TLS to protect your traffic. Trojan is designed to run inside TLS.",
        },
        {
          type: "note",
          text: "The links are shown only once and the site keeps no copy. Copy them or use **Save as .txt** before you leave the page.",
        },
      ],
    },
    {
      heading: "Android: v2rayNG",
      blocks: [
        {
          type: "steps",
          items: [
            "Install v2rayNG from its official project page on GitHub, not from a site offering a modified copy.",
            "On the result page, tap the copy button next to the link.",
            "Open v2rayNG, tap the add (+) button and choose to import from the clipboard. The new profile appears in the list with your server's name or remark.",
            "Tap the profile to select it, then tap the connect button at the bottom of the screen.",
            "Android asks whether v2rayNG may set up a VPN connection. Allow it: that is how the app sends your phone's traffic through the tunnel.",
          ],
        },
        {
          type: "p",
          text: "Created the account on a computer? Open the QR code there and use v2rayNG's scan option on your phone instead of copying text between devices.",
        },
      ],
    },
    {
      heading: "Windows: v2rayN",
      blocks: [
        {
          type: "steps",
          items: [
            "Download v2rayN from its official project page and start it.",
            "Copy the link from the result page.",
            "In v2rayN, open the servers menu and choose the option to import from the clipboard. The server appears in the list.",
            "Select it and make it the active server.",
            "Turn on v2rayN's system proxy option (from the tray icon or the bar at the bottom of the window) so your browser sends its traffic through the tunnel.",
          ],
        },
        {
          type: "p",
          text: "Unlike phone apps, v2rayN works as a proxy on your computer by default. If websites still show your usual address, the system proxy is usually what is missing.",
        },
      ],
    },
    {
      heading: "iPhone and iPad",
      blocks: [
        {
          type: "p",
          text: "Popular iOS clients for these links include Shadowrocket (paid), Streisand and V2Box. They work in much the same way:",
        },
        {
          type: "steps",
          items: [
            "Copy the link on the result page, or open its QR code on another screen.",
            "Open the app. Some clients notice a link on the clipboard and offer to add it; otherwise use the add (+) button and choose to import from the clipboard, or scan the QR code with the app's scanner.",
            "Select the new server and switch the connection on.",
            "The first time, iOS asks you to allow adding a VPN configuration. Allow it and enter your passcode if asked.",
          ],
        },
      ],
    },
    {
      heading: "When you need a JSON config",
      blocks: [
        {
          type: "p",
          text: "Most apps only need the link. Some setups want a JSON config file instead, for example the Xray program on a computer or a custom config in an app. Paste your link into [V2Ray to JSON](/tools/v2ray-to-json) and pick one of three views:",
        },
        {
          type: "ul",
          items: [
            "**Decoded JSON** shows exactly what the link contains. Use it to check the settings or to fill in an app that cannot import links.",
            "**Xray config** is a complete client config. It opens a SOCKS proxy on 127.0.0.1:10808 and an HTTP proxy on 127.0.0.1:10809 and sends that traffic through your server. Run it with xray run -c config.json, or import it as a custom config in v2rayN or v2rayNG.",
            "**Outbound only** is just the server part, for adding to a config you already have.",
          ],
        },
        {
          type: "p",
          text: "Each view can be copied or downloaded. The tool runs entirely in your browser: the link you paste is never sent to our server or saved.",
        },
      ],
    },
    {
      heading: "Check that it works",
      blocks: [
        {
          type: "p",
          text: "Once connected, open [Check My IP](/tools/my-ip). When your browser goes through the tunnel, the page shows your server's address and a green note saying that you are browsing through one of our servers. If you still see your usual address, the tunnel is not carrying your browser's traffic.",
        },
        {
          type: "p",
          text: "If the app will not connect at all, check these first:",
        },
        {
          type: "ul",
          items: [
            "**Your device's clock.** VMess checks the time, and a clock that is off by more than a minute or two makes the connection fail. Turn on automatic date and time.",
            "**The whole link was copied.** A link cut short by hand selection will not work; use the copy button.",
            "**The account is still valid.** [My accounts](/my-accounts) shows the time left for accounts created in this browser.",
            "**The server is online.** See [server status](/server-status).",
            "**Nothing was edited.** Changing the address, port or SNI in the app usually stops it from connecting.",
          ],
        },
        {
          type: "p",
          text: "Still stuck? [Fix connection problems](/guides/fix-connection-problems) goes through more cases, and you can [report a problem](/report) with the server name and the time.",
        },
      ],
    },
    {
      heading: "Keep your links private",
      blocks: [
        {
          type: "p",
          text: "A share link is not just an address: it contains your account's user ID or password. Anyone who has the link or a photo of its QR code can use your account.",
        },
        {
          type: "ul",
          items: [
            "Do not post links, screenshots or QR codes in chats, groups or forums. Publishing accounts is against our [terms](/terms).",
            "Use each account on one device. Using it on several devices at once can get it banned or removed for multi-login. It then shows as **Banned** or **Removed** on [My accounts](/my-accounts).",
            "Delete the .txt file once the link is imported, and clear any clipboard history app that keeps copied text.",
            "Need the tunnel on another device? Create another account for it.",
          ],
        },
        {
          type: "p",
          text: "The site helps by design: [My accounts](/my-accounts) keeps only a summary in your browser, never links or passwords. Our [privacy policy](/privacy) explains what is stored and for how long, and the [acceptable use policy](/acceptable-use) lists what accounts may be used for.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Why does my account have several links?",
      a: "They are the same account over different connections, such as WebSocket with TLS or gRPC. You can import more than one on the same device and switch between them, but use only one device per account.",
    },
    {
      q: "Can I change the SNI or address in the link?",
      a: "Keep them as provided. The SNI is the server name sent in the TLS handshake, and it normally has to match your server for the connection to work.",
    },
    {
      q: "Will the link work after my account expires?",
      a: "No. When the account expires, it is removed from the server and the link stops working. Create a new account and import its new link.",
    },
  ],
  related: ["vmess-vless-trojan-explained", "fix-connection-problems", "privacy-basics"],
  protocols: ["vmess", "vless", "trojan"],
};
