import { describe, expect, it } from "vitest";
import { normalizeIdempotencyKey } from "./teamDomainCommands";

describe("team domain command idempotency keys", () => {
  it("keeps short ASCII keys unchanged", () => {
    expect(normalizeIdempotencyKey("start:task-1:session-1")).toBe("start:task-1:session-1");
  });

  it("normalizes Unicode keys to a stable HTTP header-safe value", () => {
    const source = "split:task-1:第一步|第二步|第三步";
    const normalized = normalizeIdempotencyKey(source);

    expect(normalized).toBe(normalizeIdempotencyKey(source));
    expect(normalized).toMatch(/^[\x21-\x7e]+$/);
    expect(normalized).not.toContain("第一步");
  });

  it("normalizes oversized ASCII keys to stay within the database column limit", () => {
    expect(normalizeIdempotencyKey(`split:${"x".repeat(300)}`)).toMatch(/^tm-[0-9a-f]{8}-[0-9a-f]{8}$/);
  });
});
