import Link from "next/link";
import { AlertOctagonIcon, ArrowUpRightIcon, ExternalLinkIcon, FlagIcon, PlusIcon, ShieldAlertIcon, SignalIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GrowthChart } from "@/components/admin/dashboard/growth-chart";
import { Panel, panelLinkClass } from "@/components/admin/dashboard/panel";
import { PercentRing } from "@/components/admin/dashboard/percent-ring";
import { GradientStat, MiniStat } from "@/components/admin/dashboard/stats";
import { Capacity } from "@/components/admin/capacity";
import { ServerStatusBadge } from "@/components/admin/status-badge";
import { RelativeTime } from "@/components/admin/relative-time";
import { ProtocolIcon } from "@/components/protocol-icon";
import { Flag } from "@/components/public/flag";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { requirePermission } from "@/server/auth/guards";
import { can } from "@/server/auth/rbac";
import { getDashboardData } from "@/server/dashboard/queries";
import { getSiteSettings } from "@/server/settings/service";
import totalServersImage from "@/assets/total-servers.webp";
import offlineServersImage from "@/assets/offline-servers.webp";
import maintenanceServersImage from "@/assets/maintenance-servers.webp";
import calendarImage from "@/assets/domain-age-result.webp";

const ACCOUNT_BADGE = { active: "success", pending: "info", expired: "muted", revoked: "warning", failed: "danger" } as const;

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { admin } = await requirePermission("dashboard:view");
  const [d, settings] = await Promise.all([getDashboardData(), getSiteSettings()]);
  const viewAccounts = can(admin.role, "accounts:view");

  // Out of every active account (the headline number), including any on a protocol switched off since.
  const totalActive = d.accounts.active;
  const topProtocols = [...d.protocolUsage].sort((a, b) => b.active - a.active || b.month - a.month).slice(0, 6);
  const timezone = d.today.timezone.replace(/_/g, " ");

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Overview</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
          {/* Small screens: the top bar has no room for the greeting. */}
          <p className="mt-1 text-sm text-muted-foreground desk:hidden">Welcome back, {admin.name.split(" ")[0]}!</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <a href="/" target="_blank" rel="noopener">
              <ExternalLinkIcon /> View public site
            </a>
          </Button>
          {can(admin.role, "servers:create") ? (
            <Button asChild className="rounded-full shadow-md shadow-primary/25">
              <Link href="/admin/servers/new">
                <PlusIcon /> Add server
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {!admin.mfaEnabled ? (
        <Alert variant="warning" className="mb-6 rounded-2xl">
          <ShieldAlertIcon />
          <AlertTitle>Protect your account with two-factor authentication</AlertTitle>
          <AlertDescription>
            <p>
              Administrators can add servers and manage credentials.{" "}
              <Link href="/admin/account#mfa" className="font-medium text-foreground underline underline-offset-4">
                Enable 2FA
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStat
          tone="violet"
          label="Active accounts"
          value={formatNumber(d.accounts.active)}
          icon={<UsersIcon />}
          hint="In use right now"
          href={viewAccounts ? "/admin/accounts" : undefined}
        />
        <GradientStat
          tone="blue"
          label="Created today"
          value={formatNumber(d.accounts.today)}
          icon={<UserPlusIcon />}
          hint={d.accounts.failedToday ? `${d.accounts.failedToday} failed today` : `Since 00:00 ${timezone}`}
        />
        <GradientStat
          tone="mint"
          label="Servers online"
          value={
            <>
              {d.servers.online}
              <span className="text-lg font-semibold text-foreground/70"> / {d.servers.total}</span>
            </>
          }
          icon={<SignalIcon />}
          hint={d.servers.full ? `${d.servers.full} full` : "Accepting new accounts"}
          href="/admin/servers"
        />
        {can(admin.role, "reports:view") ? (
          <GradientStat
            tone="aqua"
            label="Open reports"
            value={formatNumber(d.reports.open)}
            icon={<FlagIcon />}
            hint={d.reports.open ? "Problems reported by users" : `${formatNumber(d.reports.resolved)} resolved so far`}
            href="/admin/reports"
          />
        ) : (
          <GradientStat
            tone="aqua"
            label="Recent errors"
            value={d.recentErrors.length}
            icon={<AlertOctagonIcon />}
            hint="Latest provisioning & server errors"
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat
          label="Total servers"
          value={d.servers.total}
          icon={
            // eslint-disable-next-line @next/next/no-img-element -- small bundled picture
            <img src={totalServersImage.src} alt="" aria-hidden="true" width={28} height={28} draggable={false} className="size-7 object-contain" />
          }
          hint={d.servers.pending ? `${d.servers.pending} pending` : undefined}
        />
        <MiniStat
          label="Offline"
          value={d.servers.offline}
          icon={
            // eslint-disable-next-line @next/next/no-img-element -- small bundled picture
            <img src={offlineServersImage.src} alt="" aria-hidden="true" width={28} height={28} draggable={false} className="size-7 object-contain" />
          }
          tone={d.servers.offline ? "danger" : "default"}
        />
        <MiniStat
          label="Maintenance"
          value={d.servers.maintenance}
          icon={
            // eslint-disable-next-line @next/next/no-img-element -- small bundled picture
            <img src={maintenanceServersImage.src} alt="" aria-hidden="true" width={28} height={28} draggable={false} className="size-7 object-contain" />
          }
          tone={d.servers.maintenance ? "warning" : "default"}
          hint={d.servers.disabled ? `${d.servers.disabled} disabled` : undefined}
        />
        <MiniStat
          label="This month"
          value={formatNumber(d.accounts.month)}
          icon={
            // eslint-disable-next-line @next/next/no-img-element -- small bundled picture (the Domain Age calendar)
            <img src={calendarImage.src} alt="" aria-hidden="true" width={28} height={28} draggable={false} className="size-7 object-contain" />
          }
          tone="success"
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Account growth"
          description={`Accounts created per day, last 14 days (${timezone})`}
          action={
            <span className="inline-flex h-8 items-center rounded-full bg-accent px-3.5 text-xs font-semibold text-accent-foreground">
              {formatNumber(d.accounts.today)} today
            </span>
          }
        >
          <GrowthChart data={d.trend} />
        </Panel>

        <Panel
          title="Top protocols"
          description="Share of active accounts"
          action={
            can(admin.role, "protocols:view") ? (
              <Link
                href="/admin/protocols"
                aria-label="All protocols"
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden"
              >
                <ArrowUpRightIcon className="size-4" aria-hidden />
              </Link>
            ) : null
          }
        >
          <ul className="-mx-2 grid gap-0.5">
            {topProtocols.map((p) => {
              const share = totalActive ? (p.active / totalActive) * 100 : 0;
              return (
                <li key={p.slug} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <ProtocolIcon name={p.icon} className="size-6 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatNumber(p.active)} active · {formatNumber(p.month)} this month
                    </span>
                  </span>
                  <PercentRing value={share} label={`${Math.round(share)}% of active accounts`} />
                </li>
              );
            })}
            {topProtocols.length === 0 ? <li className="px-2 text-sm text-muted-foreground">No protocols yet.</li> : null}
          </ul>
        </Panel>

        {viewAccounts ? (
          <Panel
            className="xl:col-span-2"
            title="Latest accounts"
            action={
              <Link href="/admin/accounts" className={panelLinkClass}>
                See all<span className="sr-only"> accounts</span>
              </Link>
            }
          >
            <ul className="-mx-2 grid gap-0.5">
              {d.latestAccounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted/40">
                  <UserAvatar src={`/admin/accounts/avatar/${a.id}?s=${encodeURIComponent(settings.avatarStyle)}`} size={40} />
                  <span className="grid min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="truncate font-semibold">{a.username ?? "Unnamed"}</span>
                      {a.status !== "active" ? <Badge variant={ACCOUNT_BADGE[a.status]}>{a.status}</Badge> : null}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <ProtocolIcon name={a.protocolIcon} className="size-3" />
                      {a.protocolName} · <Flag code={a.countryCode} className="h-2.5 w-3.5" /> {a.serverName}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                    <RelativeTime date={a.createdAt} />
                  </span>
                </li>
              ))}
              {d.latestAccounts.length === 0 ? <li className="px-2 text-sm text-muted-foreground">No accounts yet.</li> : null}
            </ul>
          </Panel>
        ) : null}

        <Panel
          title="Server capacity"
          action={
            <Link href="/admin/servers" className={panelLinkClass}>
              See all<span className="sr-only"> servers</span>
            </Link>
          }
        >
          <div className="grid gap-2">
            {d.capacity.map((s) => (
              <Link
                key={s.id}
                href={`/admin/servers/${s.id}`}
                className="-mx-2 grid gap-2 rounded-2xl px-2 py-2 hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden"
              >
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5 font-semibold">
                    <Flag code={s.countryCode} className="h-4 w-6 shrink-0 rounded-sm" />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <ServerStatusBadge status={s.status} />
                </span>
                <Capacity current={s.current} max={s.max} />
              </Link>
            ))}
            {d.capacity.length === 0 ? <p className="text-sm text-muted-foreground">No published servers yet.</p> : null}
          </div>
        </Panel>

        <Panel
          title="Recent activity"
          action={
            <Link href="/admin/logs" className={panelLinkClass}>
              Logs
            </Link>
          }
        >
          <ol className="relative ml-1 grid gap-3.5 border-l pl-4">
            {d.activity.map((a) => (
              <li key={a.id} className="relative text-sm">
                <span
                  className={`absolute top-1.5 -left-[21px] size-2 rounded-full ring-4 ring-card ${a.level === "error" ? "bg-destructive" : a.level === "warning" ? "bg-warning" : a.status === "success" ? "bg-success" : "bg-primary"}`}
                />
                <span className="line-clamp-2">{a.message}</span>
                <span className="text-xs text-muted-foreground">
                  <RelativeTime date={a.createdAt} />
                </span>
              </li>
            ))}
            {d.activity.length === 0 ? <li className="text-sm text-muted-foreground">Nothing yet.</li> : null}
          </ol>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Recent errors"
          action={
            <Link href="/admin/logs?level=error" className={panelLinkClass}>
              View<span className="sr-only"> all errors</span>
            </Link>
          }
        >
          <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {d.recentErrors.map((e) => (
              <li key={e.id} className="grid gap-0.5 rounded-2xl bg-danger-soft/40 px-3 py-2.5 text-sm">
                <span className="line-clamp-2">{e.message}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono">{e.event}</span> · <RelativeTime date={e.createdAt} />
                </span>
              </li>
            ))}
            {d.recentErrors.length === 0 ? <li className="text-sm text-muted-foreground">No errors. All quiet.</li> : null}
          </ul>
        </Panel>
      </div>
    </>
  );
}
