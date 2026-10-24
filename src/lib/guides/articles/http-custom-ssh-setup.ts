import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "http-custom-ssh-setup",
  title: "Set up an SSH or SSH SSL account in HTTP Custom on Android",
  description:
    "Step by step: enter an SSH or SSH SSL account from this site in HTTP Custom on Android, connect, read the log and avoid the most common setup mistakes.",
  category: "Apps",
  updated: "2026-10-24",
  intro: [
    "HTTP Custom is an Android app that connects to an SSH server and sends your phone's traffic through the encrypted tunnel. This guide walks you through taking an account you created on this site and setting it up in the app, for both plain **SSH** and **SSH SSL** (SSH inside a TLS layer, the same kind of encryption HTTPS websites use).",
    "Each step also explains why a setting matters. Once you know what each field does, a typo or a wrong port is much easier to spot. Plan on about five minutes.",
  ],
  sections: [
    {
      heading: "Before you start",
      blocks: [
        {
          type: "ul",
          items: [
            "An Android phone with HTTP Custom installed from its official Google Play listing. Avoid modified copies from other websites: a tunnel app sees all your traffic, so where it comes from matters.",
            "An SSH or SSH SSL account from this site. You can pick one from the [list of services](/#protocols).",
            "A network you are allowed to use a tunnel on. Always follow your network's terms and the law, and read our [acceptable use policy](/acceptable-use).",
          ],
        },
        {
          type: "p",
          text: "Not sure which of the two to pick? Both encrypt everything between your phone and the server with SSH. Plain SSH has the fewest settings; SSH SSL wraps the same SSH connection in an outer TLS layer on its own port. [SSH SSL explained](/guides/ssh-ssl-explained) and [How to choose a protocol](/guides/choose-a-protocol) go into more detail.",
        },
      ],
    },
    {
      heading: "Step 1: Create the account and save the details",
      blocks: [
        {
          type: "steps",
          items: [
            "Open the [list of services](/#protocols), choose SSH or SSH SSL, then a country and a server. The [server status](/server-status) page shows which servers are online and still have free slots.",
            "Fill in the form: a username, a password and how long the account should last. The durations you can choose are shown on the form.",
            "Create the account. After a few seconds the result appears with the **Host**, **IP address**, **Username**, **Password** and the ports. SSH SSL accounts usually also show an **SNI**, and some accounts show a **Payload**.",
            "Tap **Copy all details** or **Save as .txt** straight away, before you switch to HTTP Custom.",
          ],
        },
        {
          type: "note",
          text: "Your details are shown only once. The site keeps no copy of your password, so it cannot show it again or send it to you later. If you lose it, create a new account when a slot is free.",
        },
        {
          type: "p",
          text: "Your browser also keeps a short summary of the account, without the password, on the [My accounts](/my-accounts) page, with a live countdown to when it expires.",
        },
      ],
    },
    {
      heading: "Step 2: Enter the server and login details",
      blocks: [
        {
          type: "p",
          text: "HTTP Custom's screens change from version to version, so the names on your phone may differ slightly from the ones here. What matters is that each value from your account ends up in the right place. In HTTP Custom an SSH account is usually written on one line of the main screen in the form **host:port@username:password**.",
        },
        {
          type: "table",
          rows: [
            ["Setting", "Where it comes from"],
            ["Host", "The Host from your account (or the IP address shown below it)"],
            ["Port for SSH", "The SSH port or the Dropbear port"],
            ["Port for SSH SSL", "The SSL/TLS port"],
            ["Username and password", "Exactly as shown on your account"],
          ],
        },
        {
          type: "p",
          text: "For example, with the host sg1.example.net, port 22, username traveller and password sunrise42, the line reads sg1.example.net:22@traveller:sunrise42. Your own values will be different.",
        },
        {
          type: "p",
          text: "**Host or IP address?** Both point to the same server. The host name is easier to recognise; if the log says the name could not be resolved, use the IP address instead.",
        },
        {
          type: "p",
          text: "**Which port?** For plain SSH, the SSH port and the Dropbear port are two SSH servers on the same machine, so either works. If one does not connect, try the other. Do not use the SSL/TLS port in plain SSH mode: that port expects a TLS handshake first, so the app and the server would not understand each other.",
        },
      ],
    },
    {
      heading: "Step 3: For SSH SSL, turn on SSL/TLS and set the SNI",
      blocks: [
        {
          type: "p",
          text: "With SSH SSL the app first opens a TLS connection to the server and then runs SSH inside it. In HTTP Custom you switch this on with the app's SSL/TLS option (a checkbox in some versions, a connection mode in others) and enter the **SSL/TLS port** from your account as the port.",
        },
        {
          type: "p",
          text: "There is also a field for the **SNI**. SNI is the server name your phone sends at the start of the TLS handshake, so the server knows which name and certificate you expect. Enter the SNI shown on your account, which is normally the server's own host. Keep it exactly as given: a different name is the most common reason an SSH SSL connection fails at the handshake.",
        },
        {
          type: "tip",
          text: "If your account result shows no SNI field, use the Host value as the SNI.",
        },
      ],
    },
    {
      heading: "Step 4: Add a payload only if your account shows one",
      blocks: [
        {
          type: "p",
          text: "A payload is a short HTTP request the app sends to the server before SSH starts. Some ports need one: a WebSocket port, for example, expects a WebSocket upgrade request first. If your account result has a box under **Payload & config**, turn on HTTP Custom's custom payload option and paste it there.",
        },
        {
          type: "ul",
          items: [
            "Copy it with the copy button rather than selecting it by hand, so nothing gets cut off.",
            "Keep the [crlf] markers. The app turns them into the line breaks the server expects.",
            "Do not change the host names inside the payload; they belong to your server.",
            "If the box holds more than one payload, each starts with a name line. Use the one that matches the port you chose and leave the name line out.",
          ],
        },
        {
          type: "p",
          text: "If your account shows no payload, leave the custom payload option off. Plain SSH and SSH SSL connect without one.",
        },
      ],
    },
    {
      heading: "Step 5: Connect and read the log",
      blocks: [
        {
          type: "steps",
          items: [
            "Tap **Connect**.",
            "The first time, Android asks whether HTTP Custom may set up a VPN connection. Allow it: this is how the app routes your phone's traffic through the tunnel.",
            "Open the app's log screen and watch the messages while it connects.",
          ],
        },
        {
          type: "p",
          text: "A healthy log shows the app reaching the server, the SSH handshake, a successful login and finally a connected message. If it stops earlier, where it stops tells you what to fix:",
        },
        {
          type: "ul",
          items: [
            "**Login or authentication failed:** the username or password is wrong, or the account has expired.",
            "**Timeout or connection refused:** wrong port, the server is offline, or the port does not get through on your current network.",
            "**TLS or handshake error:** SSL/TLS is switched off, the port is not the SSL/TLS port, or the SNI was changed.",
          ],
        },
        {
          type: "p",
          text: "Once connected, open [Check My IP](/tools/my-ip) in your phone's browser. You should see your server's address and a green note saying that you are browsing through one of our servers.",
        },
      ],
    },
    {
      heading: "Common mistakes",
      blocks: [
        {
          type: "ul",
          items: [
            "**A space copied with the password.** Paste into a notes app first if you are unsure, and delete any space at the start or end.",
            "**SSL/TLS setting and port do not match.** SSL on goes with the SSL/TLS port; SSL off goes with the SSH or Dropbear port.",
            "**One account on two devices.** A second login disconnects the first, and the server may ban or remove the account for multi-login. It then shows as **Banned** or **Removed** on [My accounts](/my-accounts). Create one account per device instead.",
            "**The account has expired.** [My accounts](/my-accounts) shows the time left for every account you created in this browser.",
            "**The server is offline or under maintenance.** Check [server status](/server-status) and pick another server if needed.",
          ],
        },
        {
          type: "p",
          text: "For more fixes, see [Fix connection problems](/guides/fix-connection-problems). If a server shows as online but still will not work for you, please [report a problem](/report) and mention the server and the time.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Can I use HTTP Injector instead?",
      a: "Yes. HTTP Injector takes the same values: host, port, username, password and, for SSH SSL, the SSL/TLS option and SNI. Only the screens and menu names differ.",
    },
    {
      q: "Is SSH SSL more secure than plain SSH?",
      a: "Your data is encrypted by SSH in both cases. SSH SSL adds a second, TLS layer on a different port, so think of it as another way to reach the server rather than a big step up in security.",
    },
    {
      q: "Does the tunnel make me anonymous?",
      a: "No. It encrypts your traffic between your phone and our server and hides your browsing from the local network, but it is not a guarantee of anonymity. Our [privacy policy](/privacy) lists exactly what we store and what we never keep.",
    },
  ],
  related: ["ssh-ssl-explained", "fix-connection-problems", "what-is-ssh-tunneling"],
  protocols: ["ssh", "ssh-ssl"],
};
