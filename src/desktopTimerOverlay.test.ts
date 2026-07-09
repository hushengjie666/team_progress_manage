import { describe, expect, it, vi } from "vitest";
import {
  canApplyDesktopTimerOverlaySync,
  getSharedDesktopTimerOverlayRequest,
  waitForDesktopTimerOverlayCreation,
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

  it("recovers overlay creation when the created event is missed", async () => {
    vi.useFakeTimers();
    try {
      const overlayWindow = { once: vi.fn() };
      const windowLookup = {
        getByLabel: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ label: "timer-overlay" }),
      };

      const result = waitForDesktopTimerOverlayCreation(overlayWindow, windowLookup, 1000, 10);
      await vi.advanceTimersByTimeAsync(30);

      await expect(result).resolves.toBeUndefined();
      expect(overlayWindow.once).toHaveBeenCalledWith("tauri://created", expect.any(Function));
      expect(overlayWindow.once).toHaveBeenCalledWith("tauri://error", expect.any(Function));
      expect(windowLookup.getByLabel).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
