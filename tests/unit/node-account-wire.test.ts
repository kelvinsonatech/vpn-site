import { describe, expect, it } from "vitest";
import { nodeAccountWire, toNodeAccount } from "@/server/nodes/contract";

const base = { account_id: "acc_1", protocol: "ssh", username: "joy", status: "disabled", expires_at: "2026-10-25T00:00:00Z" };

describe("node account answer: blocks", () => {
  it("reads a multi-login ban and when it ends", () => {
    const a = toNodeAccount(nodeAccountWire.parse({ ...base, disabled_reason: "multi_login", disabled_until: "2026-10-22T13:00:00Z" }));
    expect(a).toMatchObject({ status: "disabled", disabledReason: "multi_login", disabledUntil: new Date("2026-10-22T13:00:00Z") });
  });

  it("ignores an odd reason or date instead of rejecting the whole answer", () => {
    const a = toNodeAccount(nodeAccountWire.parse({ ...base, disabled_reason: "Multi Login!", disabled_until: "tomorrow" }));
    expect(a.status).toBe("disabled");
    expect(a.disabledReason).toBeUndefined();
    expect(a.disabledUntil).toBeUndefined();
  });

  it("an answer without the new fields still parses", () => {
    expect(toNodeAccount(nodeAccountWire.parse({ ...base, status: "active" }))).toMatchObject({ status: "active", disabledReason: undefined });
  });
});

describe("node account answer: dates the database cannot store", () => {
  it("ignores a ban end before 1970 or after 9999 instead of failing the lookup", () => {
    for (const disabled_until of ["0000-01-01T00:00:00Z", "9999-12-31T23:59:59-23:59"]) {
      const a = toNodeAccount(nodeAccountWire.parse({ ...base, disabled_reason: "multi_login", disabled_until }));
      expect(a.disabledReason).toBe("multi_login");
      expect(a.disabledUntil).toBeUndefined();
    }
  });
});
