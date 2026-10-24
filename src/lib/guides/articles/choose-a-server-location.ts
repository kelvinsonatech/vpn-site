import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "choose-a-server-location",
  title: "How to choose a server location for a faster connection",
  description:
    "Why a nearby server is usually faster, how to read ping, status and free slots on the server status page, and what to do when your first choice is full.",
  category: "Getting started",
  updated: "2026-10-24",
  intro: [
    "When you create an account on LitronSSH, you pick a country and then a server. That choice decides where your traffic goes before it reaches the wider internet, and it affects how fast the connection feels more than almost any setting in your app.",
    "This guide explains what ping means, why distance matters, how to read the [server status page](/server-status), and what to do when the server you wanted is full or not working.",
  ],
  sections: [
    {
      heading: "Why distance matters",
      blocks: [
        {
          type: "p",
          text: "Data travels through fibre-optic cables at roughly two-thirds of the speed of light. That sounds instant, but it adds up: every 1,000 km between you and a server adds about 10 milliseconds to each round trip, and real cable routes are rarely straight lines. A server on another continent can easily add 150 ms or more to every exchange.",
        },
        {
          type: "p",
          text: "That delay is called **latency**, and the number apps show for it is usually called **ping**: the time a small message takes to reach a server and come back. Loading one web page involves many of those round trips, so a high ping makes everything feel sluggish even when the download speed itself is fine.",
        },
        {
          type: "p",
          text: "With a tunnel, your traffic makes a detour: from your device to our server, from the server to the website, and back the same way. A server close to you keeps the first part of that trip short. Many large websites also keep copies of their content in several regions, so a server near you is often near them too.",
        },
      ],
    },
    {
      heading: "Reading the server status page",
      blocks: [
        {
          type: "p",
          text: "The [server status page](/server-status) lists every public server for each protocol, including ones that are offline at the moment, and refreshes itself every 30 seconds. You can filter by service, country and status, or search for a server, city or host. Each row has these columns:",
        },
        {
          type: "ul",
          items: [
            "**Status:** **Online** means the server answers and can take new accounts. You may also see **Full**, **Maintenance**, **Offline** or **Unavailable** (that service is paused on the server).",
            "**Response:** the ping, meaning how quickly the server answered our latest health check, in milliseconds, with a colour hint: green is quick, amber is slower, red is slow. **Last checked** shows how long ago that was.",
            "**Remaining:** how many new accounts the server can still accept for that service. Slots come back at the reset times shown at the top of the site, and sometimes earlier, when other accounts on the server expire.",
            "**Action:** a **Create** button that opens the account form, or **Full** when you need another server for now.",
          ],
        },
        {
          type: "note",
          text: "The ping on our pages is measured by our own monitoring when it checks each server, not from your device. Treat it as a health signal: a server that answers quickly and was checked recently is in good shape. Your own ping depends on where you are, so a server near you will usually beat a distant one, even if the distant one shows a lower number on our page.",
        },
      ],
    },
    {
      heading: "Picking your first server",
      blocks: [
        {
          type: "steps",
          items: [
            "Find out where the internet thinks you are. [Check My IP](/tools/my-ip) shows your public address, your provider and the country your network is registered in, which is usually, but not always, where you are.",
            "On the [server status page](/server-status), choose your protocol and look for available servers in your country or the nearest one to it.",
            "Among those, prefer servers with free slots and a recent check in green or amber. If two look similar, pick either: the difference is often too small to notice.",
            "Create the account and copy your details straight away, because they are shown only once. Then connect in your app.",
            "Open Check My IP again. It should now show the server's address and a note that you are browsing through LitronSSH.",
          ],
        },
        {
          type: "tip",
          text: "To compare two servers you already have accounts on, connect to each in turn and load the same few pages. On a computer you can also run ping followed by the server's host in a terminal; some servers don't answer ping, so no reply doesn't mean a server is down. [Hostname to IP](/tools/hostname-to-ip) shows which address a host points to.",
        },
      ],
    },
    {
      heading: "When another country makes sense",
      blocks: [
        {
          type: "p",
          text: "Closest is a rule of thumb, not a law. Sometimes a server a little further away is the better choice:",
        },
        {
          type: "ul",
          items: [
            "**Your nearest server is full, offline or in maintenance.** A neighbouring country often adds only a little delay.",
            "**There is no server for your protocol nearby.** Not every protocol runs in every country, and the status page filters make this quick to check.",
            "**The route is slow.** Internet routes don't always follow the map: traffic to a nearby country sometimes travels a long way round, and busy hours can slow a route down. If a server is consistently slow for you, try another one in the same or a neighbouring country.",
          ],
        },
        {
          type: "note",
          text: "Websites adapt to the country they see, so language, search results and currency may follow the server's location, and some sites ask you to confirm a login from a new place. For banking and other sensitive accounts, a server in your own country, or no tunnel at all, avoids surprises. Wherever the server is, follow the terms of the services you use, the law and our [acceptable use policy](/acceptable-use).",
        },
      ],
    },
    {
      heading: "When a server is full or stops working",
      blocks: [
        {
          type: "p",
          text: "Each server accepts a limited number of new accounts per period, and the counter starts again at the reset times shown at the top of the site. Full only affects new accounts: existing accounts keep working until they expire.",
        },
        {
          type: "ul",
          items: [
            "**Full:** the server's page suggests other available servers in the same country. Pick one of those, choose a neighbouring country, or come back after the next reset.",
            "**Offline:** our monitoring checks every server around the clock and marks one offline only after several failed checks in a row. It shows as online again as soon as the server answers; in the meantime, use another server.",
            "**Maintenance or Unavailable:** usually temporary. Choose another server or check back later.",
            "**Online but not working for you:** follow [fixing connection problems](/guides/fix-connection-problems), and if that doesn't help, [report the problem](/report) with the server's name so we can look into it.",
          ],
        },
        {
          type: "p",
          text: "Remember that an account belongs to the server it was created on: its details won't work anywhere else, so moving means creating a new account on the other server. Please don't create accounts just to hold slots or test many servers. Slots are shared and there is a daily limit per visitor; the [fair use guide](/guides/free-accounts-fair-use) explains why.",
        },
      ],
    },
    {
      heading: "Keeping track of your accounts",
      blocks: [
        {
          type: "p",
          text: "[My accounts](/my-accounts) lists the accounts you created in this browser, with the server and a live countdown to expiry. It never stores passwords or keys, so keep your own copy of the details.",
        },
        {
          type: "ul",
          items: [
            "**Active:** accounts that are still running. Each card shows **Valid** and the time left, and you can connect.",
            "**Expired:** its time is up. Create a new account if you still need one.",
            "**Removed:** it stopped working before its expiry date, either because the server deleted it (for example for being used on more devices at once than allowed) or because an administrator removed it.",
            "**Banned:** the server blocked it for being used on more devices at once than allowed. If the ban has an end time, the card shows it; otherwise the account works again only if the server lifts the ban. Keep each account on a single device.",
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Does the ping on the status page show my speed?",
      a: "No. It shows how quickly the server answered our own monitoring. That is a good sign of a healthy server, but your ping depends on your location and connection.",
    },
    {
      q: "Is a server on another continent always slower?",
      a: "For most people, yes: distance adds delay to every round trip. Downloads can still be quick, but pages and apps will feel less responsive than with a nearby server.",
    },
    {
      q: "Can I move my account to another server?",
      a: "No. Accounts are created on one server and only work there. Create a new account on the server you want; the old one simply expires.",
    },
    {
      q: "When do full servers get slots back?",
      a: "Mostly at the reset times shown at the top of every page and on the status page. A slot can also open up earlier when another account on that server expires. Existing accounts keep working in the meantime.",
    },
  ],
  related: ["choose-a-protocol", "fix-connection-problems", "free-accounts-fair-use"],
  protocols: [],
};
