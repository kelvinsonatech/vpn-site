import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "dnstt-slowdns-fastdns-explained",
  title: "DNSTT explained: how SlowDNS and FastDNS tunnel through DNS",
  description:
    "How DNS tunnelling with DNSTT works, what the nameserver and public key in your account do, why it is slower than SSH and how to choose a DNS resolver.",
  category: "Protocols",
  updated: "2026-10-24",
  intro: [
    "SlowDNS and FastDNS are two names for the same idea: an SSH connection carried inside DNS messages, using an open-source tool called **DNSTT** (short for DNS tunnel). Instead of connecting straight to our server, your app sends its data as a stream of DNS lookups, and our server replies inside the DNS answers.",
    "It is a clever piece of engineering, and also one of the slowest ways to build a tunnel. This guide explains how it works, what the nameserver and public key in your account are for, why speeds are lower than with a direct connection, and how to choose a DNS resolver. On this site SlowDNS and FastDNS use exactly the same DNSTT setup, so everything here applies to both.",
  ],
  sections: [
    {
      heading: "DNS in one minute",
      blocks: [
        {
          type: "p",
          text: "DNS, the Domain Name System, is the internet's address book. When you open example.com, your device asks a **resolver** for that name's address. The resolver is usually run by your network or internet provider.",
        },
        {
          type: "p",
          text: "The resolver does not know every address itself. It asks the **authoritative nameserver** for the domain, the server the domain's owner has made responsible for it. This is called **delegation**: by publishing an NS (nameserver) record, a domain owner can hand any part of a domain, such as a subdomain, to a nameserver of their choice.",
        },
        {
          type: "p",
          text: "DNSTT builds on exactly that. Each DNSTT server has a tunnel domain delegated to it, so it is the authoritative nameserver for that domain. Any resolver that receives a question about a name inside the tunnel domain passes it on to our server, and passes our answer back to you.",
        },
      ],
    },
    {
      heading: "How DNSTT turns DNS into a tunnel",
      blocks: [
        {
          type: "steps",
          items: [
            "Your app takes a small piece of your data, encrypts it and encodes it as letters and digits.",
            "It turns that text into a DNS question: a long, random-looking name ending in the tunnel domain from your account. It sends the question to the resolver you chose.",
            "The resolver sees that the name belongs to the tunnel domain and forwards the question to our server.",
            "Our server decodes the data and hands it to the SSH server on the same machine. Any data waiting to go back to you is packed into the DNS answer.",
            "The answer travels back through the resolver to your app, which decodes it.",
          ],
        },
        {
          type: "p",
          text: "A DNS server can only answer questions; it cannot start a conversation. So your app keeps sending questions even when you are idle, to give the server a chance to reply with data waiting for you. DNSTT also numbers every piece and resends any that go missing, because DNS messages can be lost or arrive out of order.",
        },
        {
          type: "p",
          text: "Inside all of this runs an ordinary SSH session, which is why you still log in with a username and password. Your data is protected twice: by DNSTT's own encryption between your app and our server, and by SSH inside it.",
        },
      ],
    },
    {
      heading: "The nameserver and public key in your account",
      blocks: [
        {
          type: "p",
          text: "A SlowDNS or FastDNS account shows the usual SSH details plus a few DNSTT ones. On FastDNS accounts the labels say FastDNS instead of SlowDNS; the meaning is the same.",
        },
        {
          type: "table",
          rows: [
            ["Field", "What it is for"],
            ["Nameserver", "The tunnel domain. Your app ends every DNS question with it, so resolvers pass the questions to our server."],
            ["Public key", "Lets your app check that it is talking to our DNSTT server, and sets up the encrypted DNSTT channel."],
            ["Username and password", "Your SSH login, checked at the far end of the tunnel."],
            ["SSH port", "Only needed if your app asks for an SSH host and port."],
            [
              "SlowDNS or FastDNS port",
              "The port our DNSTT server listens on. You rarely need it, because your questions reach the server through the resolver.",
            ],
          ],
        },
        {
          type: "p",
          text: "**The public key is not a secret.** Our server keeps the matching private key, and only that key can complete the handshake your app starts. That stops another server from posing as ours, and it means the resolver in the middle can pass your data along but cannot read or change it. Your password is the part to keep private.",
        },
        {
          type: "note",
          text: "Copy the nameserver and public key with the copy buttons. One wrong character rarely produces a clear error message: the connection simply never finishes starting.",
        },
      ],
    },
    {
      heading: "Why DNSTT is slower than a direct connection",
      blocks: [
        {
          type: "ul",
          items: [
            "**Small messages.** A full domain name can be at most about 250 characters, and the encoding and tunnel domain use up part of that, so each question carries only a little of your data. Answers have more room, which is why downloads usually fare better than uploads.",
            "**An extra stop.** Every question and answer passes through the resolver, adding delay to each round trip.",
            "**Constant polling.** Your app has to keep asking for data, instead of the server sending it the moment it is ready.",
            "**Resolver limits.** Resolvers are built for normal lookups, and some limit how many questions one device can send in a short time.",
          ],
        },
        {
          type: "p",
          text: "In practice DNSTT is fine for reading pages and sending messages, while large downloads and video will be slow, and it takes longer to connect than SSH. For everyday speed, SSH, SSH SSL or a V2Ray protocol are better choices; [How to choose a protocol](/guides/choose-a-protocol) compares them. Where DNSTT really shines is as a hands-on way to see how DNS and delegation work.",
        },
      ],
    },
    {
      heading: "Choosing a DNS resolver",
      blocks: [
        {
          type: "p",
          text: "Because every message passes through the resolver, it affects DNSTT more than any other setting. Apps that support DNSTT let you choose one:",
        },
        {
          type: "ul",
          items: [
            "**Your network's own resolver.** Usually the closest one, which keeps each round trip short. A good first choice.",
            "**A well-known public resolver,** such as Google Public DNS (8.8.8.8) or Cloudflare (1.1.1.1). Worth trying if the connection stalls or keeps dropping.",
            "**Encrypted DNS** (DNS over HTTPS or DNS over TLS), if your app offers it. The local network then sees only that you are talking to the resolver, not which domain you are asking about.",
          ],
        },
        {
          type: "p",
          text: "Change one setting at a time and give each resolver a fair try, since the first connection usually takes longer. If none works, check [server status](/server-status) before suspecting your settings.",
        },
        {
          type: "note",
          text: "Use DNSTT, like any tunnel, only on networks where that is allowed. Follow your network's terms and the law, and our [acceptable use policy](/acceptable-use).",
        },
      ],
    },
    {
      heading: "SlowDNS or FastDNS?",
      blocks: [
        {
          type: "p",
          text: "Both names are used for DNSTT tunnels. On this site they are the same service with the same server setup, apps and settings, and neither is faster. Choose whichever has free slots on the server you want; [server status](/server-status) shows the free slots for each service.",
        },
      ],
    },
    {
      heading: "Setting it up",
      blocks: [
        {
          type: "steps",
          items: [
            "Create a SlowDNS or FastDNS account from the [list of services](/#protocols) and copy all the details straight away. They are shown only once.",
            "In HTTP Custom on Android or NPV Tunnel on iPhone, choose the SlowDNS (DNSTT) mode. FastDNS accounts use the same mode.",
            "Enter the nameserver, public key, username and password. If the app asks for an SSH host and port, use the Host and SSH port from your account.",
            "Choose a resolver, connect, and allow the VPN request the first time.",
            "Watch the log; starting takes longer than with SSH. Once connected, [Check My IP](/tools/my-ip) should show the server's address. If it never connects, see [Fix connection problems](/guides/fix-connection-problems).",
          ],
        },
        {
          type: "p",
          text: "On a computer you can see each layer for yourself with dnstt-client, the command-line client from the official DNSTT project. For example, dnstt-client -udp 8.8.8.8:53 -pubkey PUBLIC_KEY NAMESERVER 127.0.0.1:7000 listens on port 7000 of your own computer, and ssh -D 1080 -p 7000 username@127.0.0.1 then opens your SSH session through it, with a local SOCKS proxy on port 1080 for your browser.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Is FastDNS faster than SlowDNS?",
      a: "No. On this site they are the same DNSTT service under two names. Speed depends on the resolver, the distance to the server and your own connection, not on the name.",
    },
    {
      q: "Can the DNS resolver see what I do?",
      a: "It sees that your device sends many lookups for our tunnel domain, and roughly how much data moves. The contents are encrypted by DNSTT and again by SSH, so it cannot read or change your traffic.",
    },
    {
      q: "Why does it take so long to connect?",
      a: "Before SSH can start, your app and our server exchange several rounds of small DNS messages through the resolver. If it never finishes, copy the nameserver and public key again, then try another resolver.",
    },
  ],
  related: ["npv-tunnel-setup", "choose-a-protocol", "fix-connection-problems"],
  protocols: ["slowdns", "fastdns"],
};
