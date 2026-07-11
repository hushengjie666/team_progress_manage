import { isTauriRuntime } from "./tauriEnvironment";

const iosUserAgent = () => typeof navigator !== "undefined" && /iPhone|iPod/i.test(navigator.userAgent);
const touchMac = () => typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

export type PlatformCapabilities = {
  isTauri: boolean;
  isIOS: boolean;
  isMobile: boolean;
  supportsNativeNotifications: boolean;
  supportsLiveActivity: boolean;
  supportsBackgroundAudio: boolean;
};

export const platformCapabilities = (): PlatformCapabilities => {
  const isTauri = isTauriRuntime();
  const isIOS = isTauri && (iosUserAgent() || touchMac());
  return {
    isTauri,
    isIOS,
    isMobile: isIOS,
    supportsNativeNotifications: isTauri,
    supportsLiveActivity: isIOS,
    supportsBackgroundAudio: isIOS,
  };
};

export const platformRootClass = () => {
  const platform = platformCapabilities();
  return [platform.isTauri ? "tauri-app" : "web-app", platform.isIOS ? "ios-app" : "desktop-app"].join(" ");
};
