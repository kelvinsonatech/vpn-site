import Link from "next/link";
import { FilterIcon, UsersIcon, XIcon } from "lucide-react";
import { asc, isNull } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { RelativeTime } from "@/components/admin/relative-time";
import { ProtocolIcon } from "@/components/protocol-icon";
import { Flag } from "@/components/public/flag";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/guards";
import { can } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { accountStatus, protocols, servers } from "@/server/db/schema";
import { countAccountsByStatus, countBlockedAccounts, listAccounts, parseAccountFilters, type AdminAccountRow } from "@/server/accounts/queries";
import { getSiteSettings } from "@/server/settings/service";
import { AccountActions, AccountName, type AccountView } from "./account-actions";
import { ACCOUNT_STATUS, serverStateLabel } from "./status";

export const metadata = { title: "Accounts" };

function toView(a: AdminAccountRow, avatarStyle: string, accountCheckOn: boolean): AccountView {
  return {
    id: a.id,
    username: a.username,
    status: a.status,
    avatarUrl: `/admin/accounts/avatar/${a.id}?s=${encodeURIComponent(avatarStyle)}`,
    protocol: { name: a.protocolName, slug: a.protocolSlug, icon: a.protocolIcon },
    server: { id: a.serverId, name: a.serverName, slug: a.serverSlug, countryCode: a.countryCode, country: a.country },
    createdAt: a.createdAt.toISOString(),
    activatedAt: a.activatedAt?.toISOString() ?? null,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    revokedAt: a.revokedAt?.toISOString() ?? null,
    revokedByEmail: a.revokedByEmail,
    missingSince: a.missingSince?.toISOString() ?? null,
    answeredAt: a.answeredAt?.toISOString() ?? null,
    accountCheckOn,
    serverState:
      a.serverState === "disabled" || a.serverState === "expired"
        ? {
            state: a.serverState,
            reason: a.serverStateReason,
            since: a.serverStateSince?.toISOString() ?? null,
            until: a.serverStateUntil?.toISOString() ?? null,
          }
        : null,
    durationDays: a.durationDays,
    remoteAccountId: a.remoteAccountId,
    failureCode: a.failureCode,
    failureMessage: a.failureMessage,
    metadata: a.metadata,
  };
}

function StatusBadge({ status, missing, server }: { status: AccountView["status"]; missing?: boolean; server?: AccountView["serverState"] }) {
  const s = ACCOUNT_STATUS[status];
  const block = status === "active" && server ? serverStateLabel(server.state, server.reason) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={s.variant}>{s.label}</Badge>
      {/* The account check found it missing on its server but has not marked it removed (yet). */}
      {missing && status === "active" ? <Badge variant="warning">Missing on server</Badge> : null}
      {/* Its server still has it but blocks it (banned by the multi-login limiter, expired early). */}
      {block ? <Badge variant={block.variant}>{block.label}</Badge> : null}
    </span>
  );
}

/** Request-time helper (server component, rendered once per request). */
function msUntil(iso: string) {
  return new Date(iso).getTime() - Date.now();
}

/** Active accounts expiring within a day are amber, overdue ones red; ended accounts are muted. */
function Expiry({ iso, status }: { iso: string | null; status: AccountView["status"] }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const left = status === "active" ? msUntil(iso) : null;
  // An active account past its expiry means the expiry job has not caught up yet.
  const tone = left === null ? "text-muted-foreground" : left < 0 ? "text-destructive" : left < 86_400_000 ? "text-warning-strong" : undefined;
  return (
    <span className={cn(tone)}>
      <RelativeTime date={iso} />
    </span>
  );
}

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { admin } = await requirePermission("accounts:view");
  const sp = await searchParams;
  const f = parseAccountFilters(sp);
  const [{ rows, hasMore }, counts, blockedCount, serverOptions, protocolOptions, settings] = await Promise.all([
    listAccounts(f),
    countAccountsByStatus({ ...f, blocked: undefined }), // the status chips count every account, blocked or not
    countBlockedAccounts(f),
    db().select({ id: servers.id, name: servers.name }).from(servers).where(isNull(servers.deletedAt)).orderBy(asc(servers.name)),
    db().select({ slug: protocols.slug, name: protocols.name }).from(protocols).orderBy(asc(protocols.displayOrder)),
    getSiteSettings(),
  ]);
  const manage = can(admin.role, "accounts:manage");
  const views = rows.map((r) => toView(r, settings.avatarStyle, settings.health.accountCheckMinutes > 0));
  const iso = (d?: Date) => d?.toISOString().slice(0, 10);
  const params = {
    q: f.q,
    server: f.serverId,
    protocol: f.protocol,
    status: f.status,
    country: f.country,
    from: iso(f.createdFrom),
    to: iso(f.createdTo),
    expires: iso(f.expiresBefore),
    blocked: f.blocked ? "1" : undefined,
  };
  const total = Object.values(counts).reduce((a, n) => a + n, 0);
  const statusHref = (status?: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, status, blocked: undefined })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/admin/accounts?${s}` : "/admin/accounts";
  };
  const blockedHref = (() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, status: undefined, blocked: "1" })) if (v) q.set(k, v);
    return `/admin/accounts?${q.toString()}`;
  })();
  const filtered = Object.entries(params).some(([k, v]) => k !== "status" && k !== "blocked" && v);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every account the website has provisioned. Each one gets its own generated avatar; passwords, keys and configs are delivered to the user once and never stored."
      />

      <nav aria-label="Account status" className="mb-4 flex flex-wrap gap-1.5">
        {[{ key: undefined, label: "All", n: total }, ...accountStatus.enumValues.map((s) => ({ key: s, label: ACCOUNT_STATUS[s].label, n: counts[s] }))].map((t) => {
          const active = !f.blocked && f.status === t.key;
          return (
            <Link
              key={t.label}
              href={statusHref(t.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "border-primary/50 bg-accent text-accent-foreground hover:bg-accent",
              )}
            >
              {t.label}
              <span className="text-xs tabular-nums">{formatNumber(t.n)}</span>
            </Link>
          );
        })}
        {blockedCount || f.blocked ? (
          <Link
            href={blockedHref}
            aria-current={f.blocked ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border border-destructive/30 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10",
              f.blocked && "border-destructive/60 bg-destructive/10",
            )}
          >
            Blocked on server
            <span className="text-xs tabular-nums">{formatNumber(blockedCount)}</span>
          </Link>
        ) : null}
      </nav>

      <details className="group mb-4 rounded-xl border bg-card" open={filtered || undefined}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
          <FilterIcon className="size-4 text-muted-foreground" />
          Filters
          {filtered ? <Badge variant="info">On</Badge> : null}
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Username, server, protocol, country, dates</span>
        </summary>
        <form method="get" className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
          {f.status ? <input type="hidden" name="status" value={f.status} /> : null}
          {f.blocked ? <input type="hidden" name="blocked" value="1" /> : null}
          <label className="grid gap-1 text-xs text-muted-foreground">
            Username
            <Input name="q" defaultValue={f.q ?? ""} placeholder="e.g. cedar" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Server
            <NativeSelect name="server" defaultValue={f.serverId ?? ""}>
              <option value="">All servers</option>
              {serverOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Protocol
            <NativeSelect name="protocol" defaultValue={f.protocol ?? ""}>
              <option value="">All protocols</option>
              {protocolOptions.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Country code
            <Input name="country" defaultValue={f.country ?? ""} placeholder="e.g. DE" maxLength={2} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Created from
            <Input type="date" name="from" defaultValue={iso(f.createdFrom)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Created to
            <Input type="date" name="to" defaultValue={iso(f.createdTo)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Expires before
            <Input type="date" name="expires" defaultValue={iso(f.expiresBefore)} />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="outline">
              <FilterIcon /> Apply
            </Button>
            {filtered ? (
              <Button asChild variant="ghost">
                {/* Clears the filters, keeps the status or "Blocked on server" selection. */}
                <Link href={f.blocked ? "/admin/accounts?blocked=1" : f.status ? `/admin/accounts?status=${f.status}` : "/admin/accounts"}>
                  <XIcon /> Clear
                </Link>
              </Button>
            ) : null}
          </div>
        </form>
      </details>

      {views.length === 0 ? (
        <Card className="items-center gap-3 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UsersIcon className="size-5" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            {f.page > 1 ? "Nothing on this page." : total === 0 && !filtered ? "No accounts yet. They appear here as soon as visitors create them." : "No accounts match these filters."}
          </p>
        </Card>
      ) : (
        <>
          {/* Wide screens: table */}
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Avatar</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {views.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-64">
                      <AccountName account={a} canManage={manage} />
                      {a.failureMessage ? <span className="mt-1 block max-w-xs truncate pl-[52px] text-xs text-destructive">{a.failureMessage}</span> : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                          <ProtocolIcon name={a.protocol.icon} className="size-3.5" />
                        </span>
                        {a.protocol.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link href={`/admin/servers/${a.server.id}`} className="flex items-center gap-2 hover:underline">
                        <Flag code={a.server.countryCode} className="h-3.5 w-5" title={a.server.country} />
                        {a.server.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} missing={!!a.missingSince} server={a.serverState} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <RelativeTime date={a.createdAt} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <Expiry iso={a.expiresAt} status={a.status} />
                    </TableCell>
                    <TableCell>
                      <AccountActions account={a} canManage={manage} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Phones: cards */}
          <ul className="grid gap-3 md:hidden">
            {views.map((a) => (
              <li key={a.id}>
                <Card className="gap-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <AccountName account={a} canManage={manage} />
                    <AccountActions account={a} canManage={manage} className="-mr-1.5 shrink-0" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                    <StatusBadge status={a.status} missing={!!a.missingSince} server={a.serverState} />
                    <span className="flex items-center gap-1.5">
                      <ProtocolIcon name={a.protocol.icon} className="size-3.5 text-muted-foreground" />
                      {a.protocol.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Flag code={a.server.countryCode} className="h-3 w-4" title={a.server.country} />
                      {a.server.name}
                    </span>
                  </div>
                  {a.failureMessage ? <p className="text-xs text-destructive">{a.failureMessage}</p> : null}
                  <div className="flex justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                    <span>
                      Created <RelativeTime date={a.createdAt} />
                    </span>
                    <span>
                      Expires <Expiry iso={a.expiresAt} status={a.status} />
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
      <Pager page={f.page} hasMore={hasMore} params={params} />
    </>
  );
}
