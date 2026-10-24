import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "npv-tunnel-setup",
  title: "Use SSH, DNSTT and V2Ray accounts in NPV Tunnel",
  description:
    "Set up SSH, SSH SSL, SlowDNS, FastDNS, VMess, VLESS or Trojan accounts from this site in NPV Tunnel on iPhone or Android, then test that the tunnel works.",
  category: "Apps",
  updated: "2026-10-24",
  intro: [
    "NPV Tunnel is a tunnelling app for iPhone and Android that handles several kinds of accounts in one place. That makes it handy if you want to try SSH, a DNS tunnel (DNSTT) and V2Ray from this site without installing three different apps.",
    "This guide covers each account type in turn: what to enter, where the nameserver and public key go for SlowDNS and FastDNS, and how to check that the tunnel really works. NPV Tunnel's menus change between versions and differ a little between iPhone and Android, so the steps describe what to look for rather than exact button names.",
  ],
  sections: [
    {
      heading: "Which accounts work in NPV Tunnel",
      blocks: [
        {
          type: "p",
          text: "In NPV Tunnel you create one configuration per account and choose its type when you add it. Match the type to the protocol you created on this site:",
        },
        {
          type: "table",
          rows: [
            ["Account from this site", "What you set up in NPV Tunnel"],
            ["SSH", "An SSH configuration: host, port, username, password"],
            ["SSH SSL", "SSH with TLS turned on, plus the SNI"],
            ["SlowDNS or FastDNS", "A DNSTT configuration: nameserver, public key, resolver, username, password"],
            ["VMess, VLESS or Trojan", "A V2Ray configuration, ideally imported from the share link"],
          ],
        },
        {
          type: "p",
          text: "Install NPV Tunnel from the App Store or Google Play, not from a website offering a modified copy. A tunnel app can see all your traffic, so where it comes from matters.",
        },
      ],
    },
    {
      heading: "Before you start: create the account and save it",
      blocks: [
        {
          type: "steps",
          items: [
            "Pick a protocol from the [list of services](/#protocols), then a country and a server. [Server status](/server-status) shows which servers are online and have free slots.",
            "Fill in the form and create the account.",
            "On the result, use **Copy all details** or **Save as .txt** right away. For V2Ray accounts, the share links are under **Quick import**, each with a copy button and a QR code.",
          ],
        },
        {
          type: "note",
          text: "The details are shown only once, and the site keeps no copy of your password or share links. Save them before you leave the page.",
        },
        {
          type: "p",
          text: "Use each account on one device only. Logging in from a second device can disconnect the first, and the server may ban or remove the account for multi-login. It then shows as **Banned** or **Removed** on [My accounts](/my-accounts). If you want the tunnel on both your iPhone and your Android phone, create one account for each.",
        },
      ],
    },
    {
      heading: "SSH and SSH SSL accounts",
      blocks: [
        {
          type: "steps",
          items: [
            "Add a new configuration and choose the SSH type.",
            "Enter the **Host** from your account as the server. The IP address on your account points to the same server and works too.",
            "For plain SSH, use the **SSH port** or the **Dropbear port**. For SSH SSL, use the **SSL/TLS port** and turn on the TLS (SSL) option.",
            "Enter your **username** and **password** exactly as shown, with no spaces before or after.",
            "For SSH SSL, set the **SNI** to the value on your account, which is normally the server's host.",
            "Only if your account shows a **Payload**, turn on the payload option and paste it unchanged, [crlf] markers included. Otherwise leave it off.",
          ],
        },
        {
          type: "p",
          text: "Why the SNI matters: it is the server name your device sends at the start of the TLS handshake, so the server knows which certificate to present. If you change it to some other name, the handshake usually fails. See [SSH SSL explained](/guides/ssh-ssl-explained) for how the TLS layer works.",
        },
      ],
    },
    {
      heading: "SlowDNS and FastDNS: where the nameserver and public key go",
      blocks: [
        {
          type: "p",
          text: "SlowDNS and FastDNS both use DNSTT, which carries your SSH connection inside DNS messages. On this site they are the same service under two names, with the same apps and settings, and neither is faster than the other. DNS messages are small, so expect lower speeds than a direct SSH connection.",
        },
        {
          type: "steps",
          items: [
            "Add a new configuration and choose the DNSTT (SlowDNS) type.",
            "Copy the nameserver from your account (labelled **SlowDNS nameserver** or **FastDNS nameserver**) into the app's nameserver (NS) field. It looks like a host name.",
            "Copy the **public key** into the app's public key field. It is a long string of letters and digits; one wrong character breaks the tunnel, so always use the copy button.",
            "Choose a DNS resolver. Your network's own resolver is a good first choice; if the connection stalls, try another resolver offered in the app.",
            "Enter your **username** and **password**. If the app also asks for an SSH host and port, use the **Host** and the **SSH port** from your account.",
          ],
        },
        {
          type: "tip",
          text: "The public key is not a secret: it lets your app check that it is really talking to our DNSTT server. Your password is the part to keep private.",
        },
        {
          type: "p",
          text: "Your account also shows a SlowDNS (or FastDNS) port. Most apps never ask for it, because your DNS messages reach the server through the resolver. Only enter it if your app has a field for it. To understand what happens behind the scenes, read [DNSTT, SlowDNS and FastDNS explained](/guides/dnstt-slowdns-fastdns-explained).",
        },
      ],
    },
    {
      heading: "V2Ray accounts: VMess, VLESS and Trojan",
      blocks: [
        {
          type: "p",
          text: "V2Ray accounts come with a share link (starting with vmess://, vless:// or trojan://) that contains every setting. Importing it is far less error-prone than typing values by hand.",
        },
        {
          type: "steps",
          items: [
            "On the result page, tap the copy button next to the link under **Quick import**. If there are several links, start with a TLS one.",
            "In NPV Tunnel, add a configuration and look for an option to import from the clipboard. If your version cannot import links, choose the V2Ray type and fill in the fields from the account details.",
            "Check that the new configuration shows your server's domain, then select it.",
          ],
        },
        {
          type: "p",
          text: "If you have to enter the fields by hand, paste the link into [V2Ray to JSON](/tools/v2ray-to-json). It shows the server, port, ID or password, transport, path and SNI in plain words, and it runs entirely in your browser. [Import V2Ray links](/guides/import-v2ray-links) explains links and QR codes in more detail.",
        },
      ],
    },
    {
      heading: "Connect and test the connection",
      blocks: [
        {
          type: "steps",
          items: [
            "Select the configuration and tap connect.",
            "The first time, your phone asks for permission. On iPhone, allow NPV Tunnel to add a VPN configuration and enter your passcode if asked. On Android, accept the connection request.",
            "Watch the app's log or status while it connects. A DNSTT connection can take noticeably longer to start than SSH or V2Ray.",
            "Open [Check My IP](/tools/my-ip) in your browser. When the tunnel works, it shows your server's address and a green note saying that you are browsing through one of our servers.",
          ],
        },
        {
          type: "p",
          text: "If the address is still your usual one, the tunnel is not carrying your browser's traffic. Disconnect, check the configuration and connect again.",
        },
      ],
    },
    {
      heading: "If it does not connect",
      blocks: [
        {
          type: "ul",
          items: [
            "**Login failed:** check the username and password, and that the account has not expired on [My accounts](/my-accounts).",
            "**TLS errors with SSH SSL or V2Ray:** make sure TLS is on with the TLS port, and that the SNI still matches your server.",
            "**DNSTT never finishes connecting:** re-copy the nameserver and public key, then try another resolver.",
            "**Nothing works on any account:** look up the server on [server status](/server-status); it may be offline or under maintenance.",
          ],
        },
        {
          type: "p",
          text: "Use tunnels only on networks where you are allowed to, and follow your network's terms and the law ([acceptable use policy](/acceptable-use)). More help is in [Fix connection problems](/guides/fix-connection-problems), and you can [report a problem](/report) if a server looks broken.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Which account type should I start with in NPV Tunnel?",
      a: "SSH SSL or a V2Ray link with TLS are good first choices: quick to set up and encrypted. DNSTT is the slowest of the three, so it suits learning how DNS tunnels work more than everyday browsing. [How to choose a protocol](/guides/choose-a-protocol) compares them.",
    },
    {
      q: "Can I keep several configurations in NPV Tunnel?",
      a: "Yes, you can save several and switch between them. Just remember that each account belongs on one device, and that accounts stop working when they expire.",
    },
    {
      q: "Why is my DNSTT connection slow?",
      a: "Every piece of data has to fit into small DNS messages that travel through a resolver, which adds delay. That is normal for DNSTT. Trying a different resolver can help, but it will not match a direct SSH or V2Ray connection.",
    },
  ],
  related: ["dnstt-slowdns-fastdns-explained", "import-v2ray-links", "fix-connection-problems"],
  protocols: ["ssh", "ssh-ssl", "slowdns", "fastdns", "vmess", "vless", "trojan"],
};
