import { describe, expect, it } from "vitest";
import { canApplyDesktopTimerOverlaySync } from "./desktopTimerOverlay";

describe("desktop timer overlay sync", () => {
  it("rejects stale or disposed overlay sync attempts", () => {
    const syncSequence = { current: 2 };

    expect(canApplyDesktopTimerOverlaySync(syncSequence, 2, false)).toBe(true);
    expect(canApplyDesktopTimerOverlaySync(syncSequence, 1, false)).toBe(false);
    expect(canApplyDesktopTimerOverlaySync(syncSequence, 2, true)).toBe(false);
  });
});
