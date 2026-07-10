import { isTauriRuntime } from "./tauriEnvironment";

const RESTORE_DELAYS_MS = [0, 250, 900, 1800];

const restoreMainWindow = async () => {
  if (!isTauriRuntime()) return;
  const [{ invoke }, { getCurrentWindow }] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/api/window"),
  ]);
  const currentWindow = getCurrentWindow();
  await currentWindow.show();
  await currentWindow.unminimize();
  await currentWindow.setFocus();
  await invoke("restore_main_window_command");
};

export function scheduleTauriLaunchFocus() {
  RESTORE_DELAYS_MS.forEach((delay) => {
    window.setTimeout(() => {
      void restoreMainWindow().catch((error) => {
        console.error("Failed to focus Tauri main window on launch", error);
      });
    }, delay);
  });
}
