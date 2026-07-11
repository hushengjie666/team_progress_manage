import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformCapabilities, platformRootClass } from "./platformCapabilities";

const originalUserAgent = navigator.userAgent;
const originalPlatform = navigator.platform;
const originalTouchPoints = navigator.maxTouchPoints;
const originalWindow = globalThis.window;

beforeAll(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
});

afterAll(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent });
  Object.defineProperty(navigator, "platform", { configurable: true, value: originalPlatform });
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: originalTouchPoints });
});

describe("platform capabilities", () => {
  it("keeps an ordinary browser on the web desktop adapters", () => {
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    expect(platformCapabilities()).toMatchObject({ isTauri: false, isIOS: false, isMobile: false });
    expect(platformRootClass()).toBe("web-app desktop-app");
  });

  it("detects an iPhone Tauri webview", () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" });
    expect(platformCapabilities()).toMatchObject({
      isTauri: true,
      isIOS: true,
      isMobile: true,
      supportsLiveActivity: true,
      supportsBackgroundAudio: true,
    });
    expect(platformRootClass()).toBe("tauri-app ios-app");
  });
});
