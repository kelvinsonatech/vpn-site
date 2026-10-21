import type { StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import type { StatusPageData } from "@/lib/public/types";
import servicesImage from "@/assets/step-choose-protocol.webp";
import serversImage from "@/assets/total-servers.webp";
import onlineImage from "@/assets/servers-online.webp";
import offlineImage from "@/assets/offline-servers.webp";
import maintenanceImage from "@/assets/maintenance-servers.webp";

const nf = new Intl.NumberFormat("en-US");

function Tile({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs", className)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted [&_img]:size-7" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl leading-none font-bold tracking-tight tabular-nums">{nf.format(value)}</p>
        <p className="mt-1 text-xs leading-tight text-pretty text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** A bundled picture as a tile icon (the tile sizes it). */
function Picture({ image }: { image: StaticImageData }) {
  // eslint-disable-next-line @next/next/no-img-element -- small bundled picture
  return <img src={image.src} alt="" width={image.width} height={image.height} draggable={false} />;
}

/**
 * Summary tiles above the status tables (services, servers, online, offline, maintenance/full).
 * Phones: services full width, then a 2 × 2 block; tablets 3 + 2; desktop one row of five.
 * "Maintenance / full" counts table rows (server + protocol) in maintenance or full, the same rows
 * the board's "Full" and "Maintenance" filters show.
 */
export function StatusSummary({ data, className }: { data: StatusPageData; className?: string }) {
  const totals = data.totals;
  const paused = data.sections.reduce((n, s) => n + s.servers.filter((c) => c.availability === "maintenance" || c.availability === "full").length, 0);
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}>
      <Tile icon={<Picture image={servicesImage} />} label="Services" value={totals.protocols} className="col-span-2 sm:col-span-1" />
      <Tile icon={<Picture image={serversImage} />} label="Servers" value={totals.servers} />
      <Tile icon={<Picture image={onlineImage} />} label="Online" value={totals.online} />
      <Tile icon={<Picture image={offlineImage} />} label="Offline" value={totals.offline} />
      <Tile icon={<Picture image={maintenanceImage} />} label="Maintenance / full" value={paused} />
    </div>
  );
}
