import {
  CableIcon,
  CloudIcon,
  EyeOffIcon,
  GlobeIcon,
  KeyRoundIcon,
  LockIcon,
  NetworkIcon,
  RadarIcon,
  RadioIcon,
  RocketIcon,
  RouteIcon,
  SatelliteIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SwordsIcon,
  TerminalIcon,
  WaypointsIcon,
  WifiIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import type { ProtocolIconName } from "@/lib/protocol-icons";
import { cn } from "@/lib/utils";
import sshBadge from "@/assets/ssh-flaticon.webp";

/** Full-colour picture icons (see PROTOCOL_IMAGE_ICONS); everything else is a lucide line icon. */
const IMAGES: Partial<Record<ProtocolIconName, string>> = {
  "ssh-badge": sshBadge.src,
};

const MAP: Record<Exclude<ProtocolIconName, "ssh-badge">, LucideIcon> = {
  terminal: TerminalIcon,
  lock: LockIcon,
  globe: GlobeIcon,
  radar: RadarIcon,
  zap: ZapIcon,
  shield: ShieldIcon,
  "shield-check": ShieldCheckIcon,
  "eye-off": EyeOffIcon,
  waypoints: WaypointsIcon,
  route: RouteIcon,
  swords: SwordsIcon,
  rocket: RocketIcon,
  network: NetworkIcon,
  "key-round": KeyRoundIcon,
  wifi: WifiIcon,
  cloud: CloudIcon,
  radio: RadioIcon,
  cable: CableIcon,
  satellite: SatelliteIcon,
  server: ServerIcon,
};

export function ProtocolIcon({ name, className }: { name: string; className?: string }) {
  const image = IMAGES[name as ProtocolIconName];
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- tiny bundled icon, sized by the caller like the line icons
    return <img src={image} alt="" aria-hidden="true" width={24} height={24} draggable={false} className={cn("shrink-0 rounded-[22%] object-contain", className)} />;
  }
  const Icon = MAP[name as Exclude<ProtocolIconName, "ssh-badge">] ?? ShieldIcon;
  return <Icon className={className} aria-hidden="true" />;
}
