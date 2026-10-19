import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand";
import { ThemeSwitch } from "./fields";

/** The sign-in card: logo, heading, the form, and the light/dark switch at the bottom. */
export function AuthCard({ heading, children, className }: { heading: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[2rem] bg-card px-6 pt-10 pb-7 text-card-foreground shadow-[0_24px_60px_-28px_rgb(0_0_0/0.25)] ring-1 ring-black/5 sm:px-12 sm:pt-12 dark:ring-white/10", className)}>
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <BrandMark className="size-12" />
        {heading}
      </div>
      {children}
      <div className="mt-7 flex justify-center">
        <ThemeSwitch />
      </div>
    </section>
  );
}
