import { describe, expect, it } from "vitest";
import {
  canApplyDesktopTimerOverlaySync,
  getSharedDesktopTimerOverlayRequest,
} from "./desktopTimerOverlay";

describe("desktop timer overlay sync", () => {
  it("rejects stale or disposed overlay sync attempts", () => {
    const syncSequence = { current: 2 };

    expect(canApplyDesktopTimerOverlaySync(syncSequence, 2, false)).toBe(true);
    expect(canApplyDesktopTimerOverlaySync(syncSequence, 1, false)).toBe(false);
    expect(canApplyDesktopTimerOverlaySync(syncSequence, 2, true)).toBe(false);
  });

  it("shares an in-flight overlay window request", async () => {
    const requestRef: { current: Promise<string> | null } = { current: null };
    let createCount = 0;
    let resolveRequest: ((value: string) => void) | undefined;
    const createRequest = () => {
      createCount += 1;
      return new Promise<string>((resolve) => {
        resolveRequest = resolve;
      });
    };

    const first = getSharedDesktopTimerOverlayRequest(requestRef, createRequest);
    const second = getSharedDesktopTimerOverlayRequest(requestRef, createRequest);

    expect(first).toBe(second);
    expect(createCount).toBe(1);

    resolveRequest?.("overlay");
    await expect(first).resolves.toBe("overlay");
    await Promise.resolve();

    const third = getSharedDesktopTimerOverlayRequest(requestRef, () => Promise.resolve("next"));
    await expect(third).resolves.toBe("next");
    expect(third).not.toBe(first);
  });
});
