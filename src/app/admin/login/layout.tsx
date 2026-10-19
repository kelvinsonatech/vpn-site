import { ShieldCheckIcon } from "lucide-react";
import { AuthWaves } from "@/components/admin/auth/waves";

/**
 * Sign-in pages (password, then two-factor): a softly tinted page with drifting waves and one
 * white card in the middle. `.vl-admin` gives it the admin panel's palette.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vl-admin relative isolate flex min-h-dvh flex-col overflow-hidden bg-[color-mix(in_oklch,var(--primary)_7%,var(--background))]">
      <AuthWaves />
      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[28rem] animate-in duration-500 fade-in-0 zoom-in-95 slide-in-from-bottom-4 motion-reduce:animate-none">{children}</div>
      </main>
      <footer className="relative flex items-center justify-center gap-1.5 pb-6 text-xs text-muted-foreground">
        <ShieldCheckIcon className="size-3.5" aria-hidden /> Restricted area. All access is logged.
      </footer>
    </div>
  );
}
