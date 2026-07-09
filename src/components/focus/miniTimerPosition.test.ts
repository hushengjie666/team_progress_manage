import { describe, expect, it } from "vitest";
import { clampMiniTimerPosition, defaultMiniTimerPosition, parseMiniTimerPosition } from "./miniTimerPosition";

describe("mini timer position", () => {
  it("parses only finite coordinate objects", () => {
    expect(parseMiniTimerPosition({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
    expect(parseMiniTimerPosition({ x: Number.POSITIVE_INFINITY, y: 34 })).toBeNull();
    expect(parseMiniTimerPosition({ x: 12 })).toBeNull();
    expect(parseMiniTimerPosition(null)).toBeNull();
  });

  it("clamps panel position into viewport bounds", () => {
    expect(clampMiniTimerPosition({ x: -20, y: 999 }, 120, 80, 400, 300)).toEqual({ x: 10, y: 210 });
    expect(clampMiniTimerPosition({ x: 200, y: 120 }, 120, 80, 400, 300)).toEqual({ x: 200, y: 120 });
    expect(clampMiniTimerPosition({ x: 500, y: 500 }, 120, 80, 400, 300)).toEqual({ x: 270, y: 210 });
  });

  it("defaults to the bottom right viewport corner", () => {
    expect(defaultMiniTimerPosition(360, 180, 1440, 900)).toEqual({ x: 1070, y: 710 });
    expect(defaultMiniTimerPosition(320, 160, 800, 600)).toEqual({ x: 470, y: 430 });
  });

  it("keeps the default position visible in tight viewports", () => {
    expect(defaultMiniTimerPosition(390, 180, 400, 220)).toEqual({ x: 10, y: 30 });
    expect(defaultMiniTimerPosition(500, 260, 400, 220)).toEqual({ x: 10, y: 10 });
  });
});
