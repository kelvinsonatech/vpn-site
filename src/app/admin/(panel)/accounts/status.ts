/** Account status labels and badge colours, shared by the server page and the client row actions. */
export type AccountStatusName = "pending" | "active" | "expired" | "revoked" | "failed" | "removed";

export const ACCOUNT_STATUS: Record<AccountStatusName, { label: string; variant: "success" | "info" | "muted" | "warning" | "danger" }> = {
  active: { label: "Active", variant: "success" },
  pending: { label: "Pending", variant: "info" },
  expired: { label: "Expired", variant: "muted" },
  revoked: { label: "Revoked", variant: "warning" },
  /** Deleted by the server itself before it expired (e.g. its multi-login limiter), found by the account check. */
  removed: { label: "Removed", variant: "danger" },
  failed: { label: "Failed", variant: "danger" },
};
