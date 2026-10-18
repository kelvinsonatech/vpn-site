import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NavBadges, NavKey } from "@/components/admin/nav";
import { MobileNav } from "@/components/admin/mobile-nav";
import { AdminShell } from "@/components/admin/sidebar";
import { SIDEBAR_COOKIE } from "@/components/admin/sidebar-cookie";
import { UserMenu } from "@/components/admin/user-menu";
import { requireAdmin } from "@/server/auth/guards";
import { can, ROLE_LABELS } from "@/server/auth/rbac";
import { adminAvatar } from "@/server/avatar";
import { countOpenReports } from "@/server/reports/service";
import { getSiteSettings } from "@/server/settings/service";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

/** Open-report counter for the nav badge; the badge is simply hidden if it cannot be loaded. */
async function openReportsBadge(): Promise<number | undefined> {
  try {
    return await countOpenReports();
  } catch {
    return undefined;
  }
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const allowed: NavKey[] = [];
  if (can(admin.role, "dashboard:view")) allowed.push("dashboard");
  if (can(admin.role, "servers:view")) allowed.push("servers");
  if (can(admin.role, "protocols:view")) allowed.push("protocols");
  if (can(admin.role, "accounts:view")) allowed.push("accounts");
  if (can(admin.role, "reports:view")) allowed.push("reports");
  if (can(admin.role, "logs:view")) allowed.push("logs");
  if (can(admin.role, "admins:manage")) allowed.push("admins");
  if (can(admin.role, "settings:manage")) allowed.push("settings");

  const [settings, openReports, jar] = await Promise.all([getSiteSettings(), allowed.includes("reports") ? openReportsBadge() : undefined, cookies()]);
  const badges: NavBadges = { reports: openReports };
  const avatar = adminAvatar(admin.id, settings.avatarStyle);

  return (
    <AdminShell
      allowed={allowed}
      badges={badges}
      siteName={settings.siteName}
      initialPinned={jar.get(SIDEBAR_COOKIE)?.value === "pinned"}
      logout={logoutAction}
    >
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
        <MobileNav allowed={allowed} badges={badges} siteName={settings.siteName} logout={logoutAction} />
        <Link href="/admin" className="desk:hidden">
          <Brand name={settings.siteName} />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu name={admin.name} email={admin.email} roleLabel={ROLE_LABELS[admin.role]} avatar={avatar} logout={logoutAction} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </AdminShell>
  );
}
