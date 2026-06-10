import { isTauri } from "./env";

export async function updateDesktopTimerPresence(active: boolean, title: string) {
  document.title = title;
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    await Promise.all([appWindow.setTitle(title), appWindow.setAlwaysOnTop(active)]);
  } catch {
    // Browser preview and restricted desktop builds can safely ignore this enhancement.
  }
}
