import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "what-is-ssh-tunneling",
  title: "What is an SSH tunnel? A plain-English guide",
  description:
    "How an SSH tunnel encrypts the traffic between your device and a server, what your local network and the server can still see, and when a tunnel helps.",
  category: "Getting started",
  updated: "2026-10-24",
  intro: [
    "SSH stands for Secure Shell. It was created so that people could log in to remote computers without sending passwords across the network in readable form. The same encrypted connection can also carry other traffic, and that is what an SSH tunnel is: your apps' data travels inside an encrypted SSH connection to a server, and the server passes it on to the internet.",
    "This guide explains how that works, what a tunnel hides and what it doesn't, how it differs from a full VPN, and when it is genuinely useful. No technical background needed.",
  ],
  sections: [
    {
      heading: "How an SSH tunnel works",
      blocks: [
        {
          type: "p",
          text: "Think of a sealed pipe between two points: your device at one end and an SSH server at the other. Whatever goes in at your end comes out at the server, and nobody along the way can read it. Here is what happens when you tap connect:",
        },
        {
          type: "steps",
          items: [
            "Your app opens an ordinary network connection to the server's address, on a port from your account details. Depending on the server, the details can list several ports, for example OpenSSH, Dropbear and WebSocket.",
            "The two sides agree on fresh encryption keys for this session through a **key exchange**. The keys themselves never cross the network, so someone watching the connection cannot work them out.",
            "The server proves who it is with its **host key**. Then your app logs in with your username and password, which already travel encrypted.",
            "From then on, your traffic is wrapped in encrypted SSH packets. The server unwraps it, forwards it to the website or app you wanted, and sends the replies back through the same pipe.",
          ],
        },
        {
          type: "p",
          text: "On Android, tunnelling apps such as HTTP Custom and HTTP Injector use the phone's built-in VPN feature to steer your apps' traffic into the SSH connection, which is why Android asks you to allow a VPN connection the first time. On a computer the mechanism is easier to see: the command ssh -D 1080 user@host opens a small SOCKS proxy on your machine, and any browser you point at that proxy sends its traffic through the tunnel.",
        },
        {
          type: "tip",
          text: "Desktop clients such as PuTTY and Bitvise SSH Client show the server's host key the first time you connect, ask you to accept it and remember it. That check stops another machine from pretending to be your server, so if the app later warns that the key has changed, double-check the host before continuing.",
        },
      ],
    },
    {
      heading: "Who can see what",
      blocks: [
        {
          type: "p",
          text: "A tunnel doesn't make your traffic disappear; it moves the point where it becomes readable from the network you are on to the server. Here is what each party sees.",
        },
        {
          type: "ul",
          items: [
            "**Your local network** (the café Wi-Fi, the hotel router, the mobile network you are on) sees that your device is connected to one server address, when, and roughly how much data moves. It cannot read the contents or see which websites you open inside the tunnel.",
            "**The tunnel server** removes the SSH layer, so it can see which addresses your traffic is going to. When a website uses HTTPS (the padlock in your browser), the page itself stays encrypted between you and that website, even at the server.",
            "**The websites you visit** see the server's IP address instead of yours. You can check this with [Check My IP](/tools/my-ip): with the tunnel on, it shows the server's address.",
          ],
        },
        {
          type: "p",
          text: "Our [privacy policy](/privacy) says we do not record which websites you visit or what you send through our servers; the servers keep only what they need to run, such as whether an account is active. Even so, keep using HTTPS sites with any tunnel, so your most sensitive data is protected end to end no matter who runs the server.",
        },
        {
          type: "note",
          text: "One detail is easy to miss: DNS lookups, the step where your device turns a name like example.com into an address. If an app makes its lookups outside the tunnel, the local network can still see which site names it looks up. The [privacy basics guide](/guides/privacy-basics) covers more habits like this.",
        },
      ],
    },
    {
      heading: "SSH tunnel or full VPN?",
      blocks: [
        {
          type: "p",
          text: "On a phone the two feel the same: you tap connect, a key or VPN icon appears in the status bar, and your apps go through the server. Under the hood there are real differences.",
        },
        {
          type: "table",
          rows: [
            ["SSH tunnel", "Full VPN (for example WireGuard or OpenVPN)"],
            [
              "Carries TCP connections, which most web pages and apps use, inside one encrypted SSH session",
              "Carries whole network packets, whatever kind they are",
            ],
            ["UDP traffic, used by many games and voice calls, needs extra support in the app or may not work", "UDP traffic works natively"],
            ["Logs in with a username and password in widely used apps", "Usually needs a configuration file or key imported into a dedicated app"],
            ["On a patchy signal, one lost packet holds up everything inside the tunnel", "Usually copes better with lost packets"],
          ],
        },
        {
          type: "p",
          text: "The last row needs a word of explanation. Because everything inside an SSH tunnel shares one TCP connection, a single lost packet makes every app wait until it is sent again. On a stable line you won't notice; on weak mobile coverage the connection can feel sluggish, which is why UDP-based protocols such as Hysteria 2 exist. The [protocol guide](/guides/choose-a-protocol) compares the options.",
        },
      ],
    },
    {
      heading: "When an SSH tunnel is useful",
      blocks: [
        {
          type: "ul",
          items: [
            "**Public Wi-Fi.** In cafés, hotels, airports and stations you share the network with strangers and can't know how it is run. With a tunnel, anyone running or watching that network only sees encrypted traffic to one server.",
            "**Keeping your browsing private from the local network.** On any shared connection, such as a guest network or a flat's shared router, the tunnel keeps the list of sites you visit away from the other people on it.",
            "**A consistent address.** As long as you stay on the same server, websites see the same IP address, even when your phone switches between Wi-Fi and mobile data.",
            "**Learning how networks work.** SSH is one of the most widely used tools in computing, and setting up a tunnel, reading the connection log and comparing your IP address before and after is a hands-on way to understand encryption, ports and proxies.",
          ],
        },
        {
          type: "p",
          text: "Whatever your reason, use a tunnel on networks where that is allowed, follow the network's terms and the law, and keep to our [acceptable use policy](/acceptable-use). A tunnel changes how your traffic travels; it does not make anything acceptable that otherwise isn't.",
        },
      ],
    },
    {
      heading: "What a tunnel does not do",
      blocks: [
        {
          type: "ul",
          items: [
            "**It doesn't make you anonymous.** Websites still recognise you when you log in, and cookies work exactly as before.",
            "**It doesn't protect you from malware or phishing.** A fake login page is just as dangerous through a tunnel.",
            "**It doesn't encrypt beyond the server.** Between the server and a website, only HTTPS protects your data, so the padlock still matters.",
            "**It isn't automatically faster.** Your traffic takes a detour through the server. A nearby server keeps that detour short; see [choosing a server location](/guides/choose-a-server-location).",
          ],
        },
      ],
    },
    {
      heading: "Try it yourself",
      blocks: [
        {
          type: "steps",
          items: [
            "Open [Check My IP](/tools/my-ip) and note the address and provider it shows.",
            "Choose SSH from the [list of services](/#protocols), pick a country and a server near you, and create an account. Copy the details straight away: they are shown only once.",
            "Enter the host, port, username and password in your tunnelling app and connect. The [HTTP Custom guide](/guides/http-custom-ssh-setup) walks through this step by step.",
            "Reload Check My IP. It should now show the server's address and a note that you are browsing through LitronSSH.",
            "Disconnect when you are done. The account keeps working until it expires, and [My accounts](/my-accounts) in this browser shows how much time it has left.",
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Is an SSH tunnel safe to use on public Wi-Fi?",
      a: "Yes, that is one of its best uses. The Wi-Fi network only sees encrypted traffic going to one server. Keep using HTTPS sites as well, so your data stays protected after it leaves the server.",
    },
    {
      q: "Can I use the same account on my phone and my laptop?",
      a: "Please don't. One account is meant for one device: a second login usually disconnects the first, and the server may block the account. Create a separate account for each device instead.",
    },
    {
      q: "Can LitronSSH see the websites I visit?",
      a: "Our privacy policy says we do not record which websites you visit or what you send through our servers. Technically, any tunnel server handles your traffic on its way out, which is why HTTPS still matters.",
    },
  ],
  related: ["choose-a-protocol", "http-custom-ssh-setup", "privacy-basics"],
  protocols: ["ssh"],
};
