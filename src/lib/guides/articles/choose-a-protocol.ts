import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "choose-a-protocol",
  title: "Which protocol should I use? SSH, V2Ray, DNSTT and UDP compared",
  description:
    "SSH, SSH SSL, SlowDNS, FastDNS, VMess, VLESS, Trojan, Hysteria 2 and ZIVPN UDP compared: what each does well, which apps it needs and how to pick one.",
  category: "Getting started",
  updated: "2026-10-24",
  intro: [
    "The list of protocol names can look confusing at first, but they all do the same basic job: they carry your traffic through a tunnel from your device to one of our servers and, when set up the recommended way, encrypt it on the way. What differs is how the traffic is packaged, which apps you need, and how well each one copes with different kinds of connection.",
    "Below, the protocols are grouped into four families, followed by a comparison table and a quick decision guide. The services offered right now are listed on the [home page](/#protocols).",
  ],
  sections: [
    {
      heading: "Start with your device and app",
      blocks: [
        {
          type: "p",
          text: "The easiest way to choose is often to start from the app, because each family needs its own kind of app, and a correctly set up app matters more than small differences between protocols. These are the apps our connection guides cover:",
        },
        {
          type: "ul",
          items: [
            "**Android:** HTTP Custom and HTTP Injector for SSH and SSH SSL, and HTTP Custom for SlowDNS and FastDNS. v2rayNG, NekoBox and Hiddify for VMess, VLESS, Trojan and Hysteria 2. The ZIVPN Tunnel app for ZIVPN UDP.",
            "**iPhone and iPad:** NPV Tunnel for SSH, SSH SSL, SlowDNS and FastDNS. Shadowrocket (paid), Streisand or V2Box for VMess, VLESS and Trojan; Shadowrocket or Streisand for Hysteria 2.",
            "**Windows:** Bitvise SSH Client or PuTTY for SSH, and the command-line dnstt-client for SlowDNS and FastDNS. v2rayN, Hiddify or Clash Verge Rev for VMess, VLESS and Trojan; v2rayN or Hiddify for Hysteria 2.",
            "**macOS and Linux:** the built-in ssh command for SSH, Hiddify for VMess, VLESS, Trojan and Hysteria 2, and dnstt-client for SlowDNS and FastDNS.",
          ],
        },
      ],
    },
    {
      heading: "SSH and SSH SSL",
      blocks: [
        {
          type: "p",
          text: "**SSH** is the classic encrypted tunnel: you enter a host, port, username and password. Our servers offer it on OpenSSH, Dropbear and WebSocket ports, so you can switch ports if one doesn't connect well. It has the widest support among Android tunnelling apps and is a good first choice. [What is an SSH tunnel?](/guides/what-is-ssh-tunneling) explains how it works.",
        },
        {
          type: "p",
          text: "**SSH SSL** wraps the same SSH connection in TLS, the encryption HTTPS websites use, normally on port 443. That adds a second layer of encryption and uses the standard HTTPS port, a good alternative when the plain SSH ports don't connect well. You will see an **SNI** field: the server name your app sends at the start of the TLS handshake. Keep it set to the server's host from your account. More in [SSH over SSL explained](/guides/ssh-ssl-explained).",
        },
        {
          type: "ul",
          items: [
            "**Good at:** simple setup, wide app support and stable connections on a decent line.",
            "**Less good at:** UDP traffic such as voice calls and many games, and very patchy connections, where one lost packet holds up everything inside the tunnel.",
          ],
        },
        {
          type: "tip",
          text: "Some app modes ask for a **payload**: a short HTTP request the app sends before the tunnel starts, for example to open a WebSocket connection. If your account details include one, copy it exactly, including the [crlf] markers, which the app turns into line breaks.",
        },
      ],
    },
    {
      heading: "SlowDNS and FastDNS (DNSTT)",
      blocks: [
        {
          type: "p",
          text: "Both names refer to the same technology on this site: **DNSTT**, which carries an SSH connection inside DNS queries, the small lookup messages devices use to turn names into addresses. Your app sends queries to a DNS resolver, the resolver passes them to our server's nameserver, and the server answers inside the replies. A public key from your account encrypts the tunnel and confirms you are talking to the right server.",
        },
        {
          type: "p",
          text: "On LitronSSH, SlowDNS and FastDNS use the same apps and the same settings: a nameserver (NS), a public key, a username and a password. Neither is faster than the other, so pick whichever has a free slot on a server you like.",
        },
        {
          type: "ul",
          items: [
            "**Good at:** serving as a backup when direct connections are unreliable, and showing how DNS works under the hood.",
            "**Less good at:** speed. DNS messages are small, so throughput is lower than direct SSH. It suits light browsing and messaging better than video.",
          ],
        },
        {
          type: "p",
          text: "Copy the nameserver and public key exactly: one wrong character breaks the tunnel. The [DNSTT guide](/guides/dnstt-slowdns-fastdns-explained) has the details.",
        },
      ],
    },
    {
      heading: "VMess, VLESS and Trojan",
      blocks: [
        {
          type: "p",
          text: "These three run on Xray, a modern proxy platform, and come as **share links**: a single line starting with vmess://, vless:// or trojan:// (also shown as a QR code) that holds every setting. You import it in one go instead of typing fields, which avoids most setup mistakes.",
        },
        {
          type: "ul",
          items: [
            "**VMess** is the older design, with its own built-in encryption layer.",
            "**VLESS** is lighter: it has no encryption of its own and leaves that job to TLS, so it does less work per packet.",
            "**Trojan** is designed to run inside TLS, so with the details from your account your traffic is encrypted on its way to the server.",
          ],
        },
        {
          type: "p",
          text: "An account can come with several links, for example WebSocket with TLS, plain WebSocket and gRPC. Use the TLS link on port 443 unless you have a reason not to, and keep the SNI equal to the server's host. This matters most for VLESS: a VLESS link without TLS is not encrypted at all. The [import guide](/guides/import-v2ray-links) shows the steps, [VMess, VLESS and Trojan explained](/guides/vmess-vless-trojan-explained) goes deeper, and [V2Ray to JSON](/tools/v2ray-to-json) shows what a link contains, entirely in your browser.",
        },
      ],
    },
    {
      heading: "Hysteria 2 and ZIVPN UDP",
      blocks: [
        {
          type: "p",
          text: "These are built on UDP rather than TCP. **Hysteria 2** runs over QUIC, the transport behind HTTP/3, and is tuned to keep moving on connections that lose packets, such as a weak mobile signal or a long-distance link. You import it from a hysteria2:// link or QR code.",
        },
        {
          type: "p",
          text: "**ZIVPN UDP** is a UDP tunnel for the ZIVPN Tunnel app on Android. Setup needs only the server address, your password and the UDP port range from your account, plus an obfs value if the app asks for one.",
        },
        {
          type: "ul",
          items: [
            "**Good at:** speed on unstable or lossy connections, and traffic such as voice calls and games.",
            "**Less good at:** networks that block or limit UDP. If a UDP protocol won't connect, switch to a TCP-based one such as SSH or VLESS.",
          ],
        },
        {
          type: "p",
          text: "[Hysteria 2 and ZIVPN UDP explained](/guides/hysteria2-zivpn-udp-explained) covers both in more depth.",
        },
      ],
    },
    {
      heading: "Side-by-side comparison",
      blocks: [
        {
          type: "table",
          rows: [
            ["Protocol", "Strengths, and what you set up"],
            ["SSH", "Simple setup, widest Android app support. Host, port, username and password."],
            ["SSH SSL", "SSH with an extra TLS layer on the HTTPS port. The same details plus the SNI."],
            ["SlowDNS / FastDNS", "SSH inside DNS messages; a slower backup. Nameserver, public key, username and password."],
            ["VMess / VLESS", "One-tap import and free apps on every platform; VLESS is lighter. Share link or QR code."],
            ["Trojan", "Designed to run inside TLS. Share link or QR code."],
            ["Hysteria 2", "UDP over QUIC; holds up on weak or long-distance connections. Share link or QR code."],
            ["ZIVPN UDP", "Simple UDP tunnel for Android. Address, password and UDP port range."],
          ],
        },
      ],
    },
    {
      heading: "A simple decision guide",
      blocks: [
        {
          type: "steps",
          items: [
            "**On Android and want the easiest start?** Use SSH in HTTP Custom or HTTP Injector.",
            "**SSH ports don't connect well on your Wi-Fi?** Try SSH SSL, which uses the standard HTTPS port.",
            "**Prefer scanning a QR code to typing?** Use VLESS (or VMess or Trojan) with v2rayNG, Hiddify, Shadowrocket or v2rayN.",
            "**On a weak or unstable mobile signal, or making calls?** Try Hysteria 2. If UDP doesn't get through, go back to a TCP protocol.",
            "**Want a backup option, or curious how DNS works?** Try SlowDNS or FastDNS, and keep it for light use.",
          ],
        },
        {
          type: "note",
          text: "Whichever you choose, use it where tunnels are allowed, follow your network's terms and the law, and keep to our [acceptable use policy](/acceptable-use).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Which protocol is the fastest?",
      a: "Your connection and the server's distance matter more than the protocol. On a good line, SSH, VLESS and Trojan feel similar. On weak or lossy connections, Hysteria 2 usually holds up best. SlowDNS and FastDNS are the slowest because DNS messages are small.",
    },
    {
      q: "Is FastDNS faster than SlowDNS?",
      a: "Not on this site. Both use DNSTT with the same apps and the same settings. Only the name is different.",
    },
    {
      q: "Can one account work with several protocols?",
      a: "Use only what your account details list. An SSH account's details sometimes also include SSL/TLS, WebSocket or SlowDNS settings for the same server and login. Otherwise, create a separate account for each protocol.",
    },
    {
      q: "Are all these protocols always available?",
      a: "No. The home page lists what is offered right now, and individual servers can be full, under maintenance or offline. The [server status page](/server-status) shows live availability.",
    },
  ],
  related: ["what-is-ssh-tunneling", "choose-a-server-location", "import-v2ray-links"],
  protocols: ["ssh", "ssh-ssl", "slowdns", "fastdns", "vmess", "vless", "trojan", "hysteria2", "zivpn"],
};
