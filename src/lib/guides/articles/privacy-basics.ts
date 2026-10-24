import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "privacy-basics",
  title: "Privacy basics: what a tunnel protects, and what it doesn't",
  description:
    "What a VPN or SSH tunnel hides and what it can't, why HTTPS still matters, how to keep your account details private, and what this site stores about you.",
  category: "Privacy & fair use",
  updated: "2026-10-24",
  intro: [
    "A tunnel encrypts the traffic between your device and our server. That is a real protection, especially on networks you don't control, but it is easy to expect more from it than it can give. Knowing where the protection stops helps you use it well.",
    "Below: what a tunnel hides and from whom, the risks it does nothing about, how to keep your account details to yourself, what this site keeps, and habits that make public Wi-Fi safer.",
  ],
  sections: [
    {
      heading: "What a tunnel protects",
      blocks: [
        {
          type: "p",
          text: "With the tunnel on, your apps' traffic travels encrypted from your device to our server, and from there to the websites and services you use. That changes what each party along the way can see:",
        },
        {
          type: "table",
          rows: [
            ["Who", "What they can see with the tunnel on"],
            [
              "The local network: the Wi-Fi owner, other people on it, your internet provider",
              "That you are connected to our server, and roughly how much data moves. Not which sites you visit or what you send.",
            ],
            ["Websites and apps you use", "Our server's IP address instead of yours, plus anything you tell them yourself, such as a login."],
            [
              "Our server",
              "Your traffic passes through it on the way out. HTTPS keeps the content of most sites private, and we don't record which websites you visit.",
            ],
          ],
        },
        {
          type: "p",
          text: "This matters most on public Wi-Fi in cafés, hotels and airports, where you don't know who runs the network or who else is on it. Without a tunnel, whoever controls the network can see which sites your phone talks to; with one, they see a single encrypted connection. [Check My IP](/tools/my-ip) confirms whether you are browsing through one of our servers.",
        },
      ],
    },
    {
      heading: "What a tunnel doesn't do",
      blocks: [
        {
          type: "p",
          text: "A tunnel protects the road between you and our server. It doesn't change what happens on your device or at the website you visit:",
        },
        {
          type: "ul",
          items: [
            "**HTTPS still matters.** After our server, your traffic crosses the internet to the website as usual. HTTPS, shown by the padlock in the address bar, is what protects that part, and it keeps the content private from everyone in between, including the tunnel server. Be wary of sites without it.",
            "**Websites still know who you are when you log in.** If you sign in to email or social media, that service knows it is you, whichever IP address you appear from. Cookies can also link your visits together.",
            "**It doesn't stop malware.** A harmful or fake app on your phone can read your data before it ever enters the tunnel. Install apps only from official stores or the project's own pages, and keep your phone updated.",
            "**It doesn't stop phishing.** A fake login page is just as dangerous through a tunnel. Check the address before you type a password, and turn on two-step verification for important accounts.",
            "**It isn't anonymity.** A tunnel changes how your traffic travels. It doesn't make you invisible, and it doesn't make illegal activity legal; our [terms](/terms) say the same.",
          ],
        },
        {
          type: "tip",
          text: "Some tunnelling apps can send only selected apps through the tunnel. If you use that option, every other app connects directly, without the tunnel's protection.",
        },
      ],
    },
    {
      heading: "Keep your account details to yourself",
      blocks: [
        {
          type: "p",
          text: "Your username, password, keys and share links are the key to your account. Anyone who has them can connect as you. Because each account is meant for one device, a second person using it can get it banned or removed, and you are the one left without a working account.",
        },
        {
          type: "ul",
          items: [
            "**Don't post screenshots of the result page.** Any QR code on it contains your full login, just like the text next to it.",
            "**Treat share links as passwords.** A vmess://, vless:// or trojan:// link includes the secret your app logs in with.",
            "**Keep the saved .txt file somewhere private,** not in a shared folder or a group chat.",
            "**Don't paste your details into unknown websites or checker apps.** Our [V2Ray to JSON](/tools/v2ray-to-json) tool works entirely in your browser and never sends the links you paste to us.",
            "**Leave secrets out of reports.** The [report form](/report) asks you not to include passwords or private keys; the server and the time are what we need.",
          ],
        },
        {
          type: "p",
          text: "The [My accounts](/my-accounts) list holds only a non-secret summary of each account (protocol, server, username, avatar, expiry and details such as the host and ports), kept in your own browser. It never contains passwords, keys, links or configs, so someone who sees the list cannot use your accounts.",
        },
      ],
    },
    {
      heading: "What this site stores",
      blocks: [
        {
          type: "p",
          text: "Our [privacy policy](/privacy) is the full list and the one to rely on. In short:",
        },
        {
          type: "ul",
          items: [
            "**No sign-up.** We never ask for your name, email address or phone number to create an account.",
            "**Details shown once.** Your password, keys and config files are shown to you once, and we keep no copy. Right after creation they are held encrypted for a short time so that your browser can fetch them, then erased for good.",
            "**A small account record:** the protocol, server and validity you chose, the username or an internal identifier, and when the account was created and when it expires. It is kept after the account ends, without any credentials, for statistics and abuse prevention.",
            "**No raw IP addresses.** Rate limits and abuse protection use a keyed hash of your IP address that cannot be turned back into the address.",
            "**No record of your browsing.** We don't record which websites you visit or what you send through our servers. Servers keep only what they need to run, such as whether an account is active and health figures like CPU load.",
            "**Reports** keep what you wrote, the server and category you chose, an email address if you gave one and a keyed hash of your IP address. They are deleted automatically 90 days after they are resolved.",
          ],
        },
        {
          type: "p",
          text: "The server you picked holds your login while the account is valid, so that you can connect, and removes it when the account ends. When the captcha is switched on, Cloudflare Turnstile checks the forms, and when the site shows ads they come from Google AdSense, which sets its own cookies. The privacy policy explains each of these, including how to opt out of personalised ads.",
        },
        {
          type: "note",
          text: "The network tools work a little differently. When you use [Hostname to IP](/tools/hostname-to-ip), we remember that hostname together with the addresses it pointed to, and other people may see it through IP to Hostname. Don't look up names you want to keep private.",
        },
      ],
    },
    {
      heading: "Safer habits on public Wi-Fi",
      blocks: [
        {
          type: "p",
          text: "A tunnel works best alongside simple habits:",
        },
        {
          type: "steps",
          items: [
            "**Check the network name** with staff before joining. Attackers sometimes set up a hotspot with a convincing name, such as the name of the café.",
            "**Finish the Wi-Fi's sign-in page first,** if it has one, then turn the tunnel on. A tunnel usually cannot connect until you have accepted the hotspot's terms.",
            "**Take certificate warnings seriously.** If your browser warns that a connection is not private, don't continue to the site.",
            "**Never install a profile or certificate** that a Wi-Fi network asks for, unless you know exactly who it comes from and why.",
            "**Turn off automatic joining** for public networks and forget them when you leave, so your phone doesn't later connect to a look-alike on its own.",
            "**Keep your phone and apps updated,** and use a screen lock.",
          ],
        },
        {
          type: "p",
          text: "Android's VPN settings also include an always-on option, and many phones offer a setting there that blocks connections while the VPN is down. Whether these work with your tunnelling app depends on the app. Wherever you connect, follow the network's terms and the law, as our [acceptable use policy](/acceptable-use) asks.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Can you see which websites I visit?",
      a: "Your traffic passes through our server on its way out, but we don't record which websites you visit or what you send. HTTPS keeps the content of most sites private from everyone in between, including us.",
    },
    {
      q: "Do I need a tunnel if a site already uses HTTPS?",
      a: "HTTPS protects the content of each site. A tunnel adds a layer around all your traffic, so the local network cannot see which sites you connect to, and it also covers apps that don't encrypt their traffic well. On public Wi-Fi, using both is a good habit.",
    },
    {
      q: "Can you link an account to me?",
      a: "We never ask who you are, so usually not. Account records hold no name, email or phone number, and only a keyed hash of the IP address instead of the address itself.",
    },
  ],
  related: ["what-is-ssh-tunneling", "free-accounts-fair-use", "choose-a-protocol"],
  protocols: [],
};
