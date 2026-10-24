import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "fix-connection-problems",
  title: "Fix connection problems: a step-by-step checklist",
  description:
    "A checklist for tunnels that won't connect: account status, copy mistakes, ports and SSL, server status, DNS resolvers, your phone's clock and app logs.",
  category: "Troubleshooting",
  updated: "2026-10-24",
  intro: [
    "When a tunnel won't connect, the cause is usually small: an account that has ended, a password copied with an extra space, or the right port used with the wrong setting. Work through the checks below in order: the quick ones at the top rule out the most common causes first.",
    "It covers every protocol on the site; the last section explains how to report a problem that remains.",
  ],
  sections: [
    {
      heading: "1. Check that the account is still valid",
      blocks: [
        {
          type: "p",
          text: "Every account stops working at its end time, even in the middle of a session. Open [My accounts](/my-accounts) in the browser you used to create the account and look at its status:",
        },
        {
          type: "ul",
          items: [
            "**Valid** (active), with a countdown: the account is running.",
            "**Expired:** the time you chose has run out. Create a new account.",
            "**Removed:** the account was taken off the server early, for example because it was used on more devices at once than allowed, or an administrator removed it.",
            "**Banned for multi-login:** the server caught the account on more devices at once than allowed. If the card shows when the ban ends, it works again after that.",
            "**Blocked** or **Expired on the server:** the server is not accepting the account right now, or it has already ended there.",
          ],
        },
        {
          type: "p",
          text: "The list is kept per browser, so accounts created on another phone or in a private window won't appear, and a change such as Removed or Banned can take several minutes to show.",
        },
        {
          type: "tip",
          text: "One account is for one device. A second login usually disconnects the first and can get the account banned or removed, so create a separate account for each device.",
        },
      ],
    },
    {
      heading: "2. Look for copy mistakes",
      blocks: [
        {
          type: "p",
          text: "One wrong character is enough to stop a tunnel, and many apps don't say which field is wrong. The usual culprits:",
        },
        {
          type: "ul",
          items: [
            "**Extra spaces** at the start or end of a password or host. Use the copy buttons on the result page instead of selecting text by hand.",
            "**Look-alike characters** when typing by hand: a capital I and a small l, or a zero and the letter O.",
            "**A mistyped host,** which usually produces an unknown host or host not found error.",
            "**Long values cut short.** DNSTT public keys, V2Ray share links and payloads are long; if you passed them through a chat or notes app, check the end is still there.",
            "**An old profile.** After creating a new account, update or delete the old profile in your app so you don't connect with expired details.",
          ],
        },
        {
          type: "p",
          text: "For VMess, VLESS and Trojan, importing the share link or scanning its QR code avoids typing altogether. To see what a link contains, paste it into [V2Ray to JSON](/tools/v2ray-to-json), which works entirely in your browser.",
        },
      ],
    },
    {
      heading: "3. Match the port, the mode and the SNI",
      blocks: [
        {
          type: "p",
          text: "Each port expects one kind of connection. When the port and your app's mode don't match, the connection times out or fails during the handshake.",
        },
        {
          type: "table",
          rows: [
            ["Mode in your app", "Port to use"],
            ["SSH, with SSL/TLS switched off", "An SSH or Dropbear port from your account"],
            ["SSH over WebSocket", "A WebSocket port, with the payload from your account if it shows one"],
            ["SSH with SSL/TLS (SSH SSL)", "The SSL/TLS port, with SSL switched on in the app"],
            ["Imported V2Ray, Trojan or Hysteria 2 link", "The port inside the link; don't change it"],
            ["ZIVPN UDP", "The full UDP port range from your account"],
          ],
        },
        {
          type: "p",
          text: "For SSH SSL, also check the **SNI**: the server name your app sends at the start of the TLS handshake. Keep it as the server's host from your account; a different name can make the handshake fail. The same goes for the SNI or host field of V2Ray and Trojan profiles. In payloads, keep the [crlf] markers exactly as shown.",
        },
        {
          type: "p",
          text: "To tell whether the problem lies with the network or the account, try the same profile on another connection, for example mobile data instead of Wi-Fi. If it works there, the account is fine. Always follow each network's terms and the law, as our [acceptable use policy](/acceptable-use) asks.",
        },
      ],
    },
    {
      heading: "4. Check the server, then try another one",
      blocks: [
        {
          type: "p",
          text: "[Server status](/server-status) lists every server with its live status, ping and last check:",
        },
        {
          type: "ul",
          items: [
            "**Online:** the server is answering its health checks.",
            "**Full:** the server isn't taking new accounts right now. Existing accounts keep working, so Full alone doesn't explain a failed connection.",
            "**Maintenance:** work is in progress, and connections may fail until it ends.",
            "**Offline** or **Unavailable:** the server, or the service for that protocol, is not running.",
          ],
        },
        {
          type: "p",
          text: "A server is marked offline only after several failed checks in a row, so a fresh outage can take a few minutes to appear. The ping is measured from our website to the server, not from your phone: it shows that the server responds, not how fast it will be for you.",
        },
        {
          type: "p",
          text: "If the server looks fine but still won't connect, try a different one. An account only works on the server it was created on, so this means creating a new account there.",
        },
      ],
    },
    {
      heading: "5. SlowDNS and FastDNS: check the DNS resolver",
      blocks: [
        {
          type: "p",
          text: "SlowDNS and FastDNS both use DNSTT, which sends your data as DNS lookups through a **DNS resolver**. On this site they share the same setup and apps, and the resolver affects them more than any other setting:",
        },
        {
          type: "steps",
          items: [
            "Compare the nameserver and public key with your saved details. A wrong character rarely gives a clear error.",
            "Start with your network's own resolver, usually the closest one.",
            "If the connection stalls, try a public resolver such as 1.1.1.1 or 8.8.8.8, or encrypted DNS if your app offers it.",
            "Change one setting at a time and allow a minute or so for each attempt.",
          ],
        },
        {
          type: "p",
          text: "DNSTT is slower than a direct connection by design, so modest speeds alone don't mean something is broken. [DNSTT explained](/guides/dnstt-slowdns-fastdns-explained) covers why.",
        },
      ],
    },
    {
      heading: "6. Check your phone's clock and read the app log",
      blocks: [
        {
          type: "p",
          text: "A wrong date or time can quietly break connections. Many apps check the server's TLS certificate, which is valid only between two dates, and VMess refuses connections when your clock and the server's differ by more than a minute or two. Turn on automatic date and time in your phone's settings and check the time zone.",
        },
        {
          type: "p",
          text: "Then open your app's log screen while it connects. The last lines before it stops show where it failed, though the exact wording differs between apps:",
        },
        {
          type: "ul",
          items: [
            "**Unknown host:** the host is mistyped, or your phone has no working internet connection.",
            "**Timeout or connection refused:** the wrong port, a server that is down, or a problem with the network you are on.",
            "**TLS or handshake error:** the SSL setting doesn't match the port, the SNI was changed, or the clock is wrong.",
            "**Authentication failed:** a wrong username or password, or an account that has ended or been banned.",
          ],
        },
        {
          type: "p",
          text: "Once connected, [Check My IP](/tools/my-ip) confirms you are browsing through one of our servers.",
        },
      ],
    },
    {
      heading: "7. Report the problem with the right details",
      blocks: [
        {
          type: "p",
          text: "If a server marked Online still won't work after these checks, please tell us through [Report a problem](/report). A precise report is much quicker to check:",
        },
        {
          type: "ul",
          items: [
            "**Choose the exact server,** or the option for any server of that protocol if you're unsure.",
            "**Pick the closest category:** Can't connect, Slow or unstable, Account not working, or Something else.",
            "**Describe what happened:** the app, the port and mode, the last error line from the log, and since when.",
            "**Say what you already tried,** such as another server or another network.",
            "**Leave an email address** if you would like a reply. It is optional.",
          ],
        },
        {
          type: "note",
          text: "Never include your password, keys or a full share link in a report. A VMess, VLESS or Trojan link contains your login. The server, the protocol and the time are what we need.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "My account worked yesterday and stopped today. Why?",
      a: "Most often it has reached its end time, or it was used on a second device and then banned or removed. [My accounts](/my-accounts) shows which. If it still shows Valid, check server status and your app's log.",
    },
    {
      q: "Why does it connect and then drop after a few seconds?",
      a: "Often the same account is in use on another device, and each new login pushes the other off. Make sure only one device uses the account, then try another network or server.",
    },
    {
      q: "Can you send my password again?",
      a: "No. Details are shown once and we keep no copy. Create a new account and save its details straight away; [Free accounts and fair use](/guides/free-accounts-fair-use) explains how.",
    },
  ],
  related: ["http-custom-ssh-setup", "import-v2ray-links", "choose-a-server-location"],
  protocols: [],
};
