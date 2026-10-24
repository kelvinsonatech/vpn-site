import type { GuideArticle } from "../types";

export const article: GuideArticle = {
  slug: "free-accounts-fair-use",
  title: "How free accounts work, and the fair-use rules",
  description:
    "How free accounts work here: slots and reset times, durations, the one-time result page, My accounts, one device per account and why fair use matters.",
  category: "Privacy & fair use",
  updated: "2026-10-24",
  intro: [
    "Accounts on this site are free, need no sign-up and are created on our servers within seconds. To keep it that way for everyone, a few limits are built in: each server takes only so many new accounts per period, each account lasts for the time you choose, and each account is meant for one device.",
    "This guide explains how those limits work, why your details are shown only once, what each status on My accounts means, and what the acceptable use policy asks of you. Knowing the rules in advance saves you from losing an account at a bad moment.",
  ],
  sections: [
    {
      heading: "Slots and reset times",
      blocks: [
        {
          type: "p",
          text: "Every server accepts a limited number of new accounts for each protocol in each period. The **slots left** figure on server cards and on [server status](/server-status) is how many more it can take right now.",
        },
        {
          type: "ul",
          items: [
            "Slots refill at fixed reset times every day. The times are shown in the bar at the top of every page, together with the time zone, and the home page FAQ lists them as well.",
            "When a server shows **Full**, pick another server or come back after the next reset. Now and then a slot also frees up between resets, when an older account on that server ends.",
            "A reset only affects new accounts. Accounts that already exist keep working until their own end time.",
          ],
        },
        {
          type: "p",
          text: "There is also a daily limit on how many accounts one visitor can create for each protocol, plus a short-term limit on how quickly requests can be sent. These stop a few people from emptying every server, and the site tells you when you reach one.",
        },
        {
          type: "p",
          text: "Slots are counted per server, so a full server in one country says nothing about the others. The [list of services](/#protocols) on the home page shows which protocols are offered right now, and each protocol's page shows its countries and remaining slots.",
        },
      ],
    },
    {
      heading: "Choosing how long an account lasts",
      blocks: [
        {
          type: "p",
          text: "On the server page you choose the validity: how many days the account will last. The choices depend on the protocol. Some may be shown with a padlock, which means they cannot be chosen at the moment. The home page FAQ lists the current options.",
        },
        {
          type: "p",
          text: "Pick the shortest duration that covers what you need. The account expires on its own when the time is up and is then removed from the server. There is no way to extend it: when you need a tunnel again later, create a new account at that point. Shorter accounts also free up room on the server sooner for other people.",
        },
        {
          type: "tip",
          text: "The countdown on [My accounts](/my-accounts) shows exactly how much time is left. It is worked out with your device's clock, so keep automatic date and time switched on in your phone's settings.",
        },
      ],
    },
    {
      heading: "Save your details: the result page is one-time",
      blocks: [
        {
          type: "p",
          text: "When the account is ready, the result page shows everything your app needs: host, ports, username and password, or a share link, depending on the protocol. Each value has a copy button, and share links come with a QR code. Save them before you leave the page.",
        },
        {
          type: "steps",
          items: [
            "Tap **Copy all details** or **Save as .txt** to keep a complete copy.",
            "Set the account up in your app straight away. If the page shows a QR code and you are setting up another device, such as your phone while the page is open on a computer, scan it with that device.",
            "Keep the saved copy somewhere private: anyone who has it can use the account.",
          ],
        },
        {
          type: "p",
          text: "Why only once? Right after creation the details are encrypted and held for a short time so that your browser can fetch them, then erased for good. We keep no copy, so we cannot show them again or send them to you later, and because there is no sign-up there is no email address to send them to. A reload while the account is still being created picks up where it left off, but once the details are on screen, reloading or leaving the page shows a fresh form.",
        },
      ],
    },
    {
      heading: "My accounts: your list in this browser",
      blocks: [
        {
          type: "p",
          text: "Each account you create is added to [My accounts](/my-accounts), a list kept in your browser's local storage. It holds a non-secret summary only: protocol, server, username, avatar, expiry and details such as the host and ports. It never contains passwords, keys, links or configs, so it cannot replace your saved details. Each card shows one of these statuses:",
        },
        {
          type: "ul",
          items: [
            "**Valid** (active): the account is running, with a live countdown to its end.",
            "**Expired:** the time you chose has run out.",
            "**Removed:** the account was taken off the server before its end time, for example because it was used on more devices at once than allowed, or because it was revoked for breaking the rules.",
            "**Banned for multi-login:** the server caught the account on more devices at once than allowed. If the server gives an end time for the ban, the card shows it.",
            "**Blocked** or **Expired on the server:** the server is not accepting the account right now, or has already ended it.",
          ],
        },
        {
          type: "p",
          text: "The list belongs to this browser on this device. It isn't synced, so it won't appear in another browser or in a private window, and clearing your browser data empties it. Removing a card or clearing the list only tidies the list: the account itself keeps running until it expires.",
        },
      ],
    },
    {
      heading: "One device per account",
      blocks: [
        {
          type: "p",
          text: "Each account is meant for one device. When a second device logs in with the same details, the first is usually disconnected, and servers watch for accounts in use on several devices at once. An account caught that way can be banned for a while or removed for good.",
        },
        {
          type: "p",
          text: "If you want a tunnel on both your phone and your laptop, create one account for each. That is within the rules, and a problem on one device then doesn't knock out the other. Sharing one account among friends, on the other hand, usually ends with nobody able to use it.",
        },
      ],
    },
    {
      heading: "Fair use: why the rules matter",
      blocks: [
        {
          type: "p",
          text: "Our servers are shared by many people, so one person's behaviour affects everyone on the same machine. The [acceptable use policy](/acceptable-use) lists the rules in full, alongside the short house rules shown next to every account form. Among other things, it does not allow:",
        },
        {
          type: "ul",
          items: [
            "anything illegal where you are or where the server is located;",
            "attacks of any kind, such as flooding, scanning or breaking into systems;",
            "fraud, phishing, spam or spreading malware;",
            "torrenting, P2P file sharing and other copyright infringement;",
            "reselling, renting or publishing accounts, or creating them in bulk or with scripts to get around the slot limits;",
            "using so much bandwidth or so many connections that other people on the server suffer.",
          ],
        },
        {
          type: "p",
          text: "Abuse has real costs for other users. Spam or attacks sent through a server can get its address blocked by websites and email providers, so everyone on it starts seeing errors and extra captchas. Bulk sign-ups drain slots that others were waiting for, and very heavy use slows down every connection on that server. Each of these can lead to tighter limits for everyone.",
        },
        {
          type: "note",
          text: "Accounts that break the rules can be revoked immediately and without warning, and further account creation can be blocked. A tunnel doesn't make illegal activity legal.",
        },
        {
          type: "p",
          text: "In everyday use, fair use is simple: one account per device, disconnect when you don't need the tunnel, and let accounts expire instead of creating new ones in a row. If you see a server being misused, tell us through the [report form](/report) and include the server name and the time it happened.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Why can't I create an account right now?",
      a: "The server may be full, offline or under maintenance, or you may have reached the daily limit for that protocol. Try another server on [server status](/server-status), or wait for the reset time shown at the top of the site.",
    },
    {
      q: "I lost my password. Can you send it again?",
      a: "No. We keep no copy, so it cannot be shown or sent again. Create a new account and save its details straight away; the old one simply expires on its own.",
    },
    {
      q: "Does clearing My accounts delete my accounts?",
      a: "No. It only removes the summaries from your browser. The accounts keep working until they expire, so keep your saved details if you still need them.",
    },
  ],
  related: ["privacy-basics", "fix-connection-problems", "choose-a-server-location"],
  protocols: [],
};
