import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "hysteria2-zivpn-udp-explained",
  title: "Hysteria 2 and ZIVPN UDP explained: how UDP tunnels work",
  description:
    "How Hysteria 2 and ZIVPN UDP work, why UDP tunnels cope better with weak mobile signals, what the port and obfuscation fields mean, and when TCP is better.",
  category: "Protocols",
  updated: "2026-10-24",
  intro: [
    "Many tunnels on this site, such as SSH, VLESS and Trojan, travel over TCP. **Hysteria 2** and **ZIVPN UDP** are different: they carry your traffic over UDP. On a patchy mobile signal or a long-distance link, that difference can make a tunnel feel noticeably smoother.",
    "This guide explains the difference, how to set up both, what their fields mean, and when a TCP-based protocol is still the better choice. Which protocols are offered at any time is shown in the [list of services](/#protocols) on the home page.",
  ],
  sections: [
    {
      heading: "TCP and UDP in plain words",
      blocks: [
        {
          type: "p",
          text: "Everything you do online travels in small packets, sent in one of two basic ways:",
        },
        {
          type: "ul",
          items: [
            "**TCP** guarantees delivery in order. Every packet is numbered and acknowledged, and anything lost is sent again before the data behind it is handed over. Web pages, email and most apps use it.",
            "**UDP** simply sends packets and leaves it to the program on top to deal with anything that goes missing. Voice and video calls, online games and live streams use it, because late data is often worse than missing data.",
          ],
        },
        {
          type: "p",
          text: "That freedom to handle loss in its own way is exactly what Hysteria 2 builds on.",
        },
      ],
    },
    {
      heading: "Why UDP tunnels can feel faster on mobile",
      blocks: [
        {
          type: "p",
          text: "A TCP-based tunnel such as SSH carries all your connections inside one TCP connection. When a single packet is lost, everything inside the tunnel waits until it has been sent again, even data for a different app. On a clean line this rarely happens. On a weak mobile signal or busy public Wi-Fi, where packets go missing all the time, those waits add up to stalls.",
        },
        {
          type: "p",
          text: "TCP also reads lost packets as a sign that the network is overloaded, and slows down sharply. On mobile, loss is often caused by radio interference rather than overload, so slowing down just wastes the connection you have.",
        },
        {
          type: "p",
          text: "Hysteria 2 runs over **QUIC**, the transport behind HTTP/3. QUIC deals with lost packets itself, separately for each stream, so a missing packet only holds up the one connection it belonged to. Hysteria 2 also uses congestion control tuned for lossy networks, which keeps data flowing at a steady pace instead of backing off at every gap.",
        },
        {
          type: "tip",
          text: "This is about coping with loss, not magic speed. On a strong, stable connection, SSH, VLESS and Hysteria 2 feel much the same, and the distance to the server matters more.",
        },
      ],
    },
    {
      heading: "Hysteria 2: QUIC with a password",
      blocks: [
        {
          type: "p",
          text: "Hysteria 2 is an open-source proxy built on QUIC. QUIC always encrypts with TLS 1.3, so the tunnel between your device and the server is encrypted by design. Your app proves which account it belongs to with a **password**, which comes inside the share link.",
        },
        {
          type: "p",
          text: "Your account comes with a **hysteria2://** share link and a QR code. Apps that support it include:",
        },
        {
          type: "ul",
          items: [
            "**Android:** NekoBox, Hiddify and v2rayNG.",
            "**iPhone and iPad:** Shadowrocket (paid) and Streisand.",
            "**Windows:** v2rayN and Hiddify.",
            "**macOS:** Hiddify. **Linux:** the official Hysteria 2 client or Hiddify.",
          ],
        },
        {
          type: "steps",
          items: [
            "Create a Hysteria 2 account on a server near you and keep the result page open.",
            "Copy the Hysteria 2 link under **Quick import**, or show its QR code on another screen.",
            "In your app, add a profile by importing from the clipboard or scanning the QR code.",
            "Select the profile and connect. On a phone, allow the VPN permission prompt, which lets the app route your traffic through the tunnel.",
            "Open [Check My IP](/tools/my-ip) to confirm that you are browsing through the server.",
          ],
        },
        {
          type: "tip",
          text: "Some apps show upload and download speed fields for Hysteria. Leave them empty, or enter what your connection really manages. Setting them well above your real speed makes things worse.",
        },
      ],
    },
    {
      heading: "ZIVPN UDP: a simple tunnel for one app",
      blocks: [
        {
          type: "p",
          text: "ZIVPN UDP is a UDP tunnel built on Hysteria and made for the **ZIVPN Tunnel** app on Android. There is no share link or QR code: you enter a few values from your account by hand. The result page lists them under **Account details**, each with its own copy button.",
        },
        {
          type: "steps",
          items: [
            "Create a ZIVPN UDP account and keep the result page open.",
            "Open the ZIVPN app and add a new server.",
            "Enter the **Server** address and the **Password** exactly as the result page shows them.",
            "Enter the **UDP port range** exactly as shown: both numbers and the dash between them.",
            "If your account shows an **Obfuscation** value and the app asks for one, enter it too. Then save and connect.",
          ],
        },
        {
          type: "p",
          text: "Use it on one device only: logging in from a second device usually disconnects the first, and an account used on several devices at once may be banned, shown as **Banned** on [My accounts](/my-accounts). Details are shown only once, so copy them or save the .txt file before leaving.",
        },
      ],
    },
    {
      heading: "What the port and obfuscation fields mean",
      blocks: [
        {
          type: "p",
          text: "You rarely need to change any of these fields, but knowing what they do helps when something does not connect.",
        },
        {
          type: "table",
          rows: [
            ["Field", "What it means"],
            ["Server", "The server's host name: where your app connects."],
            [
              "Port",
              "Hysteria 2: the UDP port. It can be one number, a list, or a range written as two numbers with a dash; with a range, the app may move between ports during a session (port hopping).",
            ],
            ["UDP port range", "ZIVPN: the UDP ports the server answers on. Enter the range exactly as shown."],
            ["Password", "Your account's secret. Hysteria 2 carries it inside the share link; ZIVPN needs it typed in."],
            [
              "Obfuscation and obfuscation password",
              "An optional layer that scrambles every packet with a shared secret (for Hysteria 2 the type is called Salamander; ZIVPN shows a single Obfuscation value). If your account does not list these fields, the server does not use them; if it does, the app must use the same values.",
            ],
            ["SNI", "The server name sent in the TLS handshake inside QUIC. Keep it as the server's host."],
            [
              "Allow insecure and certificate pin",
              "How the app checks the server's certificate. A pin is the certificate's fingerprint. Keep both as the link sets them.",
            ],
          ],
        },
        {
          type: "note",
          text: "Obfuscation is not what keeps your data private: the TLS 1.3 encryption inside QUIC does that. Never switch on allow insecure yourself if your account says No: it turns off the check that you reached the real server.",
        },
      ],
    },
    {
      heading: "When a TCP-based protocol is the better choice",
      blocks: [
        {
          type: "p",
          text: "UDP tunnels are not always the right tool. Pick SSH, SSH SSL, VLESS or Trojan instead when:",
        },
        {
          type: "ul",
          items: [
            "**UDP does not get through well.** Some networks drop or limit UDP traffic. If a UDP account will not connect or keeps dropping on a network where tunnels are allowed, a TCP protocol is usually more dependable there.",
            "**Your connection is already strong and stable.** On good fibre or a strong signal there is little loss to cope with, so UDP gains you little.",
            "**Your device or app does not support it.** ZIVPN UDP is for the Android app only, and on an iPhone Hysteria 2 needs an app such as Shadowrocket or Streisand.",
          ],
        },
        {
          type: "note",
          text: "Whichever protocol you use, follow your network's terms and the law, and keep to our [acceptable use policy](/acceptable-use). If a network does not allow tunnels, do not use one there.",
        },
      ],
    },
    {
      heading: "If it will not connect",
      blocks: [
        {
          type: "ul",
          items: [
            "**Check that the account is still valid** on [My accounts](/my-accounts). Expired or removed accounts stop working.",
            "**Check the server** on [server status](/server-status).",
            "**Import or copy again** instead of editing fields. A changed SNI, port or password breaks the connection.",
            "**Compare with another connection** you normally use, such as home Wi-Fi instead of mobile data, to see whether UDP is the issue.",
          ],
        },
        {
          type: "p",
          text: "Still stuck? See [Fix connection problems](/guides/fix-connection-problems), or [report a problem](/report) with the server name and time.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Is Hysteria 2 encrypted?",
      a: "Yes. QUIC always uses TLS 1.3, so the connection to the server is encrypted. An obfuscation password, when your account has one, is an extra layer, not the encryption itself.",
    },
    {
      q: "Will a UDP tunnel lower my ping in games?",
      a: "It can make play smoother when your connection loses packets, but it cannot shorten the distance. Your traffic now travels via the server, so pick one close to you or to the game server. [Choose a server location](/guides/choose-a-server-location) explains how.",
    },
    {
      q: "Can I use a ZIVPN account in a Hysteria 2 app, or the other way round?",
      a: "No. Each account is created for one protocol on one server, and the two are set up differently: Hysteria 2 comes as a share link, while ZIVPN needs its fields typed into the ZIVPN app.",
    },
  ],
  related: ["choose-a-protocol", "choose-a-server-location", "fix-connection-problems"],
  protocols: ["hysteria2", "zivpn"],
};
