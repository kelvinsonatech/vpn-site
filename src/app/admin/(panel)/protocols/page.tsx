import Link from "next/link";
import { ExternalLinkIcon, LockKeyholeIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ProtocolIcon } from "@/components/protocol-icon";
import { requirePermission } from "@/server/auth/guards";
import { can } from "@/server/auth/rbac";
import { listProtocolsForAdmin } from "@/server/protocols/service";
import { ProtocolToggle } from "./protocol-toggle";
import { getSiteSettings } from "@/server/settings/service";
import { NODE_PROTOCOL_OF } from "@/lib/node-protocol-of";

export const metadata = { title: "Protocols" };

const CATEGORY_LABEL: Record<string, string> = { ssh: "SSH", v2ray: "V2Ray / Xray", vpn: "VPN", proxy: "Proxy" };

export default async function ProtocolsPage() {
  const { admin } = await requirePermission("protocols:view");
  const [rows, { lockedDurations }] = await Promise.all([listProtocolsForAdmin(), getSiteSettings()]);
  const edit = can(admin.role, "protocols:edit");
  return (
    <>
      <PageHeader
        title="Protocols"
        description="Protocol pages, forms and outputs are driven by these definitions. Servers are listed automatically when they report a protocol's identifier."
        actions={
          edit ? (
            <Button asChild>
              <Link href="/admin/protocols/new">
                <PlusIcon /> New protocol
              </Link>
            </Button>
          ) : null
        }
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocol</TableHead>
              <TableHead className="hidden md:table-cell">Server identifiers</TableHead>
              <TableHead className="text-right">Servers</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="hidden sm:table-cell">Durations</TableHead>
              <TableHead className="w-20 text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ protocol: p, serversPublished, serversDetected, activeAccounts }) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-96">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <ProtocolIcon name={p.icon} className="size-4" />
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/admin/protocols/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <Badge variant="muted">{CATEGORY_LABEL[p.category] ?? p.category}</Badge>
                        {!p.isSystem ? <Badge variant="info">Custom</Badge> : null}
                      </span>
                      {p.description ? <span className="truncate text-xs text-muted-foreground">{p.description}</span> : null}
                      <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        {p.enabled && serversPublished > 0 ? (
                          <a href={`/${p.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-primary hover:underline">
                            /{p.slug}
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        ) : (
                          <span>/{p.slug}</span>
                        )}
                        <span>· {p.adapterKey}</span>
                      </span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-64 truncate font-mono text-xs text-muted-foreground md:table-cell">
                  {p.nodeIdentifiers.join(", ") || (NODE_PROTOCOL_OF[p.slug] ? `uses ${NODE_PROTOCOL_OF[p.slug]}` : "—")}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {serversPublished}
                  <span className="text-muted-foreground"> / {serversDetected}</span>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{activeAccounts}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {p.durationOptions.map((d, i) => (
                    <span key={d} className={lockedDurations.includes(d) ? "text-muted-foreground/60" : "text-foreground"}>
                      {i ? ", " : null}
                      {lockedDurations.includes(d) ? <LockKeyholeIcon aria-label="locked" className="mr-0.5 inline size-3 align-[-1px]" /> : null}
                      {d}
                    </span>
                  ))}{" "}
                  days
                </TableCell>
                <TableCell className="text-right">
                  <ProtocolToggle id={p.id} name={p.name} enabled={p.enabled} disabled={!edit} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Servers: published / detected. A protocol page goes live once at least one published server offers the protocol.
      </p>
    </>
  );
}
