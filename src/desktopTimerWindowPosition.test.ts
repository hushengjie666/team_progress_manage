import { describe, expect, it } from "vitest";
import {
  clampDesktopTimerWindowPosition,
  defaultDesktopTimerWindowPosition,
  parseDesktopTimerWindowPosition,
  resolveDesktopTimerWindowPosition,
  type DesktopTimerWorkArea,
} from "./desktopTimerWindowPosition";

const workArea: DesktopTimerWorkArea = {
  position: { x: 0, y: 25 },
  size: { width: 1440, height: 875 },
};

describe("desktop timer window position", () => {
  it("parses finite desktop coordinates", () => {
    expect(parseDesktopTimerWindowPosition({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
    expect(parseDesktopTimerWindowPosition({ x: Number.NaN, y: 34 })).toBeNull();
    expect(parseDesktopTimerWindowPosition({ y: 34 })).toBeNull();
    expect(parseDesktopTimerWindowPosition(null)).toBeNull();
  });

  it("defaults to the desktop work area bottom right", () => {
    expect(defaultDesktopTimerWindowPosition(360, 170, workArea)).toEqual({ x: 1056, y: 706 });
  });

  it("clamps restored positions into the current work area", () => {
    expect(clampDesktopTimerWindowPosition({ x: -100, y: 2000 }, 360, 170, workArea)).toEqual({ x: 24, y: 706 });
    expect(clampDesktopTimerWindowPosition({ x: 300, y: 400 }, 360, 170, workArea)).toEqual({ x: 300, y: 400 });
    expect(clampDesktopTimerWindowPosition({ x: 1300, y: 20 }, 360, 170, workArea)).toEqual({ x: 1056, y: 49 });
  });

  it("resolves stored position or falls back to default", () => {
    expect(resolveDesktopTimerWindowPosition({ x: 100, y: 120 }, 360, 170, workArea)).toEqual({ x: 100, y: 120 });
    expect(resolveDesktopTimerWindowPosition(null, 360, 170, workArea)).toEqual({ x: 1056, y: 706 });
  });
});
