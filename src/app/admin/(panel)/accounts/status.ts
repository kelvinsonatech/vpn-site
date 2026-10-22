/** Account status labels and badge colours, shared by the server page and the client row actions. */
export type AccountStatusName = "pending" | "active" | "expired" | "revoked" | "failed" | "removed";

/** How a block reported by the account's server (vpn_accounts.server_state) is labelled for admins. */
export function serverStateLabel(state: string, reason: string | null): { label: string; variant: "danger" | "warning" } {
  if (state === "expired") return { label: "Expired on server", variant: "warning" };
  if (reason === "multi_login") return { label: "Banned: multi-login", variant: "danger" };
  return { label: reason ? `Blocked on server (${reason.replace(/_/g, " ")})` : "Blocked on server", variant: "danger" };
}

export const ACCOUNT_STATUS: Record<AccountStatusName, { label: string; variant: "success" | "info" | "muted" | "warning" | "danger" }> = {
  active: { label: "Active", variant: "success" },
  pending: { label: "Pending", variant: "info" },
  expired: { label: "Expired", variant: "muted" },
  revoked: { label: "Revoked", variant: "warning" },
  /** Deleted by the server itself before it expired (e.g. its multi-login limiter), found by the account check. */
  removed: { label: "Removed", variant: "danger" },
  failed: { label: "Failed", variant: "danger" },
};
