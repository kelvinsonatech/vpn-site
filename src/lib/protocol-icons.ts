/**
 * Icon names an administrator can choose for a protocol: lucide-react line icons, plus image icons
 * (full-colour pictures, listed in PROTOCOL_IMAGE_ICONS) such as "ssh-badge".
 */
export const PROTOCOL_ICON_NAMES = [
  "terminal",
  "ssh-badge",
  "lock",
  "ssh-ssl-badge",
  "globe",
  "radar",
  "zap",
  "shield",
  "shield-check",
  "eye-off",
  "waypoints",
  "route",
  "swords",
  "rocket",
  "network",
  "key-round",
  "wifi",
  "cloud",
  "radio",
  "cable",
  "satellite",
  "server",
] as const;

export type ProtocolIconName = (typeof PROTOCOL_ICON_NAMES)[number];

/** Icons that are full-colour pictures rather than line icons (they fill their tile instead of sitting on a coloured one). */
export const PROTOCOL_IMAGE_ICONS: ReadonlySet<string> = new Set(["ssh-badge", "ssh-ssl-badge"]);

/** Picture icons that are circles: their tile is round too. */
export const ROUND_PROTOCOL_ICONS: ReadonlySet<string> = new Set(["ssh-ssl-badge"]);

export const isImageProtocolIcon = (name: string) => PROTOCOL_IMAGE_ICONS.has(name);
export const isRoundProtocolIcon = (name: string) => ROUND_PROTOCOL_ICONS.has(name);

/** Credits required by the licences of image icons, shown in the site footer. */
export const ICON_CREDITS = [{ label: "SSH icon", source: "Flaticon", href: "https://www.flaticon.com/free-icon/ssh_5136897" }] as const;
