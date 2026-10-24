import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "ssh-ssl-explained",
  title: "SSH SSL explained: SSH inside TLS, SNI, ports and payloads",
  description:
    "What the TLS layer in SSH SSL adds, what the SNI, SSL/TLS ports and payload in your account are for, how WebSocket TLS works and how to read the errors.",
  category: "Protocols",
  updated: "2026-10-24",
  intro: [
    "SSH SSL is an ordinary SSH tunnel with one extra layer around it: **TLS**, the same encryption standard that protects HTTPS websites. Your app first opens a TLS connection to the server and then runs a normal SSH session inside it. On the server, a small program called stunnel adds and removes that outer layer.",
    "This guide explains what the extra layer adds, what each setting in your account is for, and how to read the errors you are most likely to see. If tunnels are new to you, start with [What is an SSH tunnel?](/guides/what-is-ssh-tunneling)",
  ],
  sections: [
    {
      heading: "How SSH SSL works: a tunnel inside a tunnel",
      blocks: [
        {
          type: "p",
          text: "Picture two envelopes: your data goes into a sealed SSH envelope, and that goes into a TLS envelope for the trip across the network. Here is what happens when you tap connect:",
        },
        {
          type: "steps",
          items: [
            "Your app opens a network connection to the server's host on the **SSL/TLS port** from your account.",
            "It starts a **TLS handshake**. The very first message includes the **SNI**, the server name your app expects. The server answers with its certificate, and both sides agree on keys for the outer layer.",
            "On the server, stunnel removes the TLS layer and hands the connection to the SSH server on the same machine.",
            "Inside the TLS layer, your app and the SSH server do their own key exchange, and you log in with your username and password.",
            "From then on, everything you send is encrypted by SSH, wrapped again by TLS, and unwrapped in reverse order at the server before it continues to the website or app you asked for.",
          ],
        },
        {
          type: "p",
          text: "Because stunnel only handles the outer layer, everything else works as with plain SSH: the same username and password, and the same one-account-per-device rule.",
        },
      ],
    },
    {
      heading: "What the TLS layer adds, and what it doesn't",
      blocks: [
        {
          type: "p",
          text: "Your data is already encrypted by SSH, so the TLS layer is not mainly about secrecy. What it changes is the outside of the connection. Plain SSH opens with a short exchange anyone on the network path can read: a greeting that names the SSH software and its version, and the lists of encryption methods each side supports. With SSH SSL that exchange happens inside TLS, the protocol behind every HTTPS website, so the local network sees only a standard TLS handshake. The second layer of encryption is a bonus.",
        },
        {
          type: "table",
          rows: [
            ["Plain SSH", "SSH SSL"],
            ["Connects to the SSH or Dropbear port", "Connects to an SSL/TLS port"],
            ["Encrypted once, by SSH", "Encrypted by SSH, then wrapped in TLS"],
            ["SSH greeting readable on the network", "SSH greeting hidden inside TLS"],
            ["No SNI needed", "Sends an SNI at the start of the TLS handshake"],
          ],
        },
        {
          type: "note",
          text: "TLS does not hide that you are connected to our server. Your local network still sees the server's address, roughly how much data moves and the SNI, which is normally sent unencrypted. The [privacy basics guide](/guides/privacy-basics) explains what a tunnel can and cannot hide.",
        },
      ],
    },
    {
      heading: "SNI: the name your app announces",
      blocks: [
        {
          type: "p",
          text: "SNI stands for Server Name Indication. One server address can host many names, so at the start of a TLS handshake your app says which name it wants to reach. The server uses that name to pick the right certificate.",
        },
        {
          type: "p",
          text: "Your SSH SSL account shows an **SNI** value, which is normally the server's own host. Enter it exactly as shown:",
        },
        {
          type: "ul",
          items: [
            "**No SNI field in your account?** Use the Host from your account.",
            "**Connecting by IP address?** Still put the host name in the SNI field. The IP address gets your app to the right machine; the SNI tells that machine which name you expect.",
            "**Keep it exactly as shown.** The SNI should name the server you are actually connecting to. Use the copy button so a typo cannot creep in, because a wrong name can stop the handshake from completing.",
          ],
        },
      ],
    },
    {
      heading: "Ports: SSL/TLS, WebSocket TLS and why there are several",
      blocks: [
        {
          type: "p",
          text: "A port is a numbered door on the server, and each service listens behind its own doors. An SSH SSL account lists one or more **SSL/TLS ports**, often numbers such as 443, 447 or 777, and may also list a **WebSocket TLS port**. Use the numbers your account shows, because they can differ between servers.",
        },
        {
          type: "ul",
          items: [
            "**Every listed SSL/TLS port works with the same account and settings.** 443 is the standard HTTPS port; others, such as 447 or 777, are extra doors to the same service. If one does not connect, try another listed port before changing anything else, and check [server status](/server-status) if none of them do.",
            "**Match the mode to the port.** Do not use an SSL/TLS port with TLS switched off, or the SSH port with TLS switched on. One expects a TLS handshake and the other an SSH greeting, so a mismatch fails straight away.",
          ],
        },
        {
          type: "p",
          text: "**WebSocket TLS** is a second way to reach SSH through TLS. After the TLS handshake, your app sends a short HTTP request asking to switch the connection to WebSocket, a standard web technology for long-lived, two-way connections. The server agrees, and SSH then travels through that connection. Because it starts with an HTTP request, WebSocket TLS needs a payload.",
        },
      ],
    },
    {
      heading: "Payloads, without the mystery",
      blocks: [
        {
          type: "p",
          text: "A payload is a few lines of HTTP, the language browsers and web servers use, that your app sends right after connecting and before SSH starts. It is not a password or a secret setting, just the opening message some server ports expect.",
        },
        {
          type: "p",
          text: "A typical WebSocket payload looks like this: GET / HTTP/1.1[crlf]Host: [host][crlf]Upgrade: websocket[crlf][crlf]. Your app fills in the words in square brackets: [host] becomes your server's host, and [crlf] becomes a line break, the way HTTP separates lines. The blank line at the end tells the server the request is complete.",
        },
        {
          type: "ul",
          items: [
            "**Use the payload from your account result.** When the server has one, it appears under **Payload & config**, written for that server's ports. The example above only shows the idea.",
            "**Paste it unchanged,** with the [crlf] markers and host names exactly as they are.",
            "**Several payloads?** Each starts with a name line ending in a colon. Pick the one whose name matches the connection you are setting up, and paste it without the name line.",
            "**No payload in your account?** Use an SSL/TLS port, which connects without one, and leave the app's payload option off.",
          ],
        },
      ],
    },
    {
      heading: "Setting it up and reading the log",
      blocks: [
        {
          type: "p",
          text: "HTTP Custom and HTTP Injector on Android, and NPV Tunnel on iPhone, all support SSH SSL. Menus change between versions, so look for these settings rather than exact labels:",
        },
        {
          type: "steps",
          items: [
            "Create an SSH SSL account from the [list of services](/#protocols) and copy all the details at once. They are shown only once.",
            "In your app, choose SSH and turn on the SSL/TLS (stunnel) option.",
            "Enter the host, one of the **SSL/TLS ports**, your username, your password and the **SNI**.",
            "For WebSocket TLS, use the **WebSocket TLS port** instead and add the payload. Otherwise leave the payload off.",
            "Connect, allow the VPN request the first time, and open the app's log.",
          ],
        },
        {
          type: "ul",
          items: [
            "**Fails at the TLS handshake:** check that TLS is switched on, that the port is one of your SSL/TLS ports, and that the SNI matches your account.",
            "**The handshake works, then the connection hangs or drops:** often the payload does not match the port. WebSocket TLS needs its payload; a plain SSL/TLS port works without one.",
            "**Authentication failed:** wrong username or password, or the account has expired or been banned for logging in on several devices. [My accounts](/my-accounts) shows its status.",
            "**Timeout:** the server may be offline (see [server status](/server-status)), or that port is not reachable from your connection right now, so try another listed port.",
          ],
        },
        {
          type: "p",
          text: "Screen-by-screen help is in the [HTTP Custom guide](/guides/http-custom-ssh-setup) and the [NPV Tunnel guide](/guides/npv-tunnel-setup), and more fixes are in [Fix connection problems](/guides/fix-connection-problems). Wherever you connect, follow the network's terms and the law, and our [acceptable use policy](/acceptable-use).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Is SSH SSL faster than plain SSH?",
      a: "Not really. The TLS layer adds a little extra work that you are unlikely to notice. Speed depends far more on the distance to the server and on your own connection.",
    },
    {
      q: "Is SSH SSL safer than plain SSH on public Wi-Fi?",
      a: "Both encrypt your traffic, so both are a good choice on public Wi-Fi. With either, the network sees the server's address and how much data moves, but not the contents. SSH SSL hides the SSH greeting but shows the SNI instead.",
    },
  ],
  related: ["http-custom-ssh-setup", "what-is-ssh-tunneling", "fix-connection-problems"],
  protocols: ["ssh-ssl", "ssh"],
};
