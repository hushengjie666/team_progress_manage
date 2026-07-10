import { describe, expect, it } from "vitest";
import { todayKey } from "./seed";

describe("todayKey", () => {
  it("uses the local calendar date instead of the UTC date", () => {
    expect(todayKey(new Date(2026, 6, 8, 0, 30))).toBe("2026-07-08");
  });

  it("pads month and day values", () => {
    expect(todayKey(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});
