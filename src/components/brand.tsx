import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import wolf from "@/assets/brand-wolf.webp";

/** The wolf logo on a white tile. Decorative: the site name is always beside it or in the link's label. */
export function BrandMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small bundled logo, sized by the caller
    <img
      src={wolf.src}
      alt=""
      aria-hidden="true"
      width={wolf.width}
      height={wolf.height}
      draggable={false}
      className={cn("size-7 shrink-0 rounded-[28%] bg-white object-cover ring-1 ring-black/5", className)}
    />
  );
}

/** Logo + site name. `name` overrides the build-time default (the public site passes settings.siteName). */
export function Brand({ className, suffix, name, markClassName }: { className?: string; suffix?: string; name?: string; markClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <BrandMark className={markClassName} />
      <span className="truncate">{name || siteConfig.name}</span>
      {suffix ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}
