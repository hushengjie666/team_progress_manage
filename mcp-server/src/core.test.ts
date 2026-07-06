import { describe, expect, it } from "vitest";
import { requireConfirmation } from "./core.js";

describe("TimeManage MCP guardrails", () => {
  it("requires explicit confirmation for high-risk actions", () => {
    expect(() => requireConfirmation(false, "delete_task")).toThrow(/explicit user confirmation/i);
    expect(() => requireConfirmation(undefined, "accept_task_review")).toThrow(/explicit user confirmation/i);
    expect(() => requireConfirmation(true, "delete_task")).not.toThrow();
  });
});
