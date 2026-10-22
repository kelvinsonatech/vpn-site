import { describe, expect, it } from "vitest";
import { escapeLike } from "@/server/db/like";

describe("escapeLike", () => {
  it("keeps the text but makes %, _ and \\ literal", () => {
    expect(escapeLike("account.server_state")).toBe("account.server\\_state");
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("plain")).toBe("plain");
  });
});
