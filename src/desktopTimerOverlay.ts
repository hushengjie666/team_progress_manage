import { useEffect, useMemo, useRef } from "react";
import { buildDesktopTimerPayload, type DesktopTimerEndPayload, type DesktopTimerPayload } from "./desktopTimerPayload";
import {
  readStoredDesktopTimerWindowPosition,
  resolveDesktopTimerWindowPosition,
  type DesktopTimerWorkArea,
} from "./desktopTimerWindowPosition";
import { isTauriRuntime } from "./tauriEnvironment";
import type { AppState, Task } from "./types";

export const DESKTOP_TIMER_WINDOW_LABEL = "timer-overlay";
export const DESKTOP_TIMER_STATE_EVENT = "desktop-timer:state";
export const DESKTOP_TIMER_READY_EVENT = "desktop-timer:ready";
export const DESKTOP_TIMER_TOGGLE_EVENT = "desktop-timer:toggle";
export const DESKTOP_TIMER_ABORT_EVENT = "desktop-timer:abort";
export const DESKTOP_TIMER_ENDED_EVENT = "desktop-timer:ended";

const DESKTOP_TIMER_WINDOW_WIDTH = 304;
const DESKTOP_TIMER_WINDOW_HEIGHT = 138;

let overlayVisible = false;

export const getSharedDesktopTimerOverlayRequest = <T>(
  requestRef: { current: Promise<T> | null },
  createRequest: () => Promise<T>,
) => {
  if (requestRef.current) return requestRef.current;
  const request = createRequest();
  requestRef.current = request;
  const clearRequest = () => {
    if (requestRef.current === request) requestRef.current = null;
  };
  void request.then(clearRequest, clearRequest);
  return request;
};

export const canApplyDesktopTimerOverlaySync = (
  syncSequence: { current: number },
  syncId: number,
  disposed: boolean,
) => !disposed && syncSequence.current === syncId;

type DesktopTimerOverlayOptions = {
  state: AppState | null;
  currentTask?: Task;
  toggleTimer: () => void;
  abortTimer: () => void;
};

const currentOverlayUrl = () => {
  const path = window.location.pathname || "/";
  return `${path}?window=${DESKTOP_TIMER_WINDOW_LABEL}`;
};

const createOrGetOverlayWindow = async () => {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  let overlayWindow = await WebviewWindow.getByLabel(DESKTOP_TIMER_WINDOW_LABEL);
  if (overlayWindow) {
    const { LogicalSize } = await import("@tauri-apps/api/dpi");
    const overlaySize = new LogicalSize(DESKTOP_TIMER_WINDOW_WIDTH, DESKTOP_TIMER_WINDOW_HEIGHT);
    await overlayWindow.setMinSize(null);
    await overlayWindow.setMaxSize(null);
    await overlayWindow.setSize(overlaySize);
    await overlayWindow.setMinSize(overlaySize);
    await overlayWindow.setMaxSize(overlaySize);
    await overlayWindow.setShadow(false);
    await overlayWindow.setFocusable(false);
    return overlayWindow;
  }

  overlayWindow = new WebviewWindow(DESKTOP_TIMER_WINDOW_LABEL, {
    url: currentOverlayUrl(),
    title: "TimeManage Timer",
    width: DESKTOP_TIMER_WINDOW_WIDTH,
    height: DESKTOP_TIMER_WINDOW_HEIGHT,
    minWidth: DESKTOP_TIMER_WINDOW_WIDTH,
    minHeight: DESKTOP_TIMER_WINDOW_HEIGHT,
    maxWidth: DESKTOP_TIMER_WINDOW_WIDTH,
    maxHeight: DESKTOP_TIMER_WINDOW_HEIGHT,
    decorations: false,
    transparent: true,
    shadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    focus: false,
    focusable: false,
    visible: false,
    acceptFirstMouse: true,
    preventOverflow: { width: 12, height: 12 },
  });

  await new Promise<void>((resolve, reject) => {
    void overlayWindow.once("tauri://created", () => resolve());
    void overlayWindow.once("tauri://error", (event) => reject(new Error(String(event.payload))));
  });

  return overlayWindow;
};

const overlayWindowRequestRef: {
  current: ReturnType<typeof createOrGetOverlayWindow> | null;
} = { current: null };

const ensureOverlayWindow = () => (
  getSharedDesktopTimerOverlayRequest(overlayWindowRequestRef, createOrGetOverlayWindow)
);

const workAreaFromCurrentMonitor = async (): Promise<DesktopTimerWorkArea | null> => {
  const { currentMonitor, primaryMonitor } = await import("@tauri-apps/api/window");
  const monitor = await currentMonitor() ?? await primaryMonitor();
  return monitor?.workArea ?? null;
};

const positionOverlayWindow = async (overlayWindow: Awaited<ReturnType<typeof ensureOverlayWindow>>) => {
  const workArea = await workAreaFromCurrentMonitor();
  if (!workArea) return;

  const { PhysicalPosition } = await import("@tauri-apps/api/dpi");
  const size = await overlayWindow.outerSize();
  const position = resolveDesktopTimerWindowPosition(
    readStoredDesktopTimerWindowPosition(),
    size.width,
    size.height,
    workArea,
  );
  await overlayWindow.setPosition(new PhysicalPosition(Math.round(position.x), Math.round(position.y)));
};

const emitOverlayState = async (payload: DesktopTimerPayload, syncSequence?: number) => {
  const { emitTo } = await import("@tauri-apps/api/event");
  await emitTo(DESKTOP_TIMER_WINDOW_LABEL, DESKTOP_TIMER_STATE_EVENT, {
    ...payload,
    syncSequence,
  });
};

export const emitDesktopTimerEnded = async (payload: DesktopTimerEndPayload) => {
  if (!isTauriRuntime()) return;
  const { emitTo } = await import("@tauri-apps/api/event");
  await emitTo(DESKTOP_TIMER_WINDOW_LABEL, DESKTOP_TIMER_ENDED_EVENT, payload);
};

const hideOverlayWindow = async (canApplySync: () => boolean = () => true) => {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const overlayWindow = await WebviewWindow.getByLabel(DESKTOP_TIMER_WINDOW_LABEL);
  if (!canApplySync()) return;
  if (overlayWindow) await overlayWindow.hide();
  if (!canApplySync()) return;
  overlayVisible = false;
};

const showOverlayWindow = async (
  payload: DesktopTimerPayload,
  syncSequence?: number,
  canApplySync: () => boolean = () => true,
) => {
  const overlayWindow = await ensureOverlayWindow();
  if (!canApplySync()) return;
  const isVisible = await overlayWindow.isVisible().catch(() => overlayVisible);
  if (!canApplySync()) return;
  if (!isVisible) await positionOverlayWindow(overlayWindow);
  if (!canApplySync()) return;
  await overlayWindow.setAlwaysOnTop(true);
  if (!canApplySync()) return;
  await overlayWindow.show();
  if (!canApplySync()) return;
  overlayVisible = true;
  await emitOverlayState(payload, syncSequence);
};

export function useDesktopTimerOverlay({ state, currentTask, toggleTimer, abortTimer }: DesktopTimerOverlayOptions) {
  const syncSequenceRef = useRef(0);
  const payloadRef = useRef<DesktopTimerPayload | null>(null);
  const payload = useMemo(
    () => buildDesktopTimerPayload(
      state?.auth.status === "authenticated" ? state : null,
      currentTask,
    ),
    [
      state,
      currentTask?.id,
      currentTask?.title,
      currentTask?.actualPomodoros,
      currentTask?.estimatePomodoros,
    ],
  );
  const hasPayload = payload !== null;
  payloadRef.current = payload;

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let disposed = false;
    const syncId = syncSequenceRef.current + 1;
    syncSequenceRef.current = syncId;
    const canApplySync = () => canApplyDesktopTimerOverlaySync(syncSequenceRef, syncId, disposed);

    const syncOverlay = async () => {
      try {
        if (!payload) {
          await hideOverlayWindow(canApplySync);
          return;
        }
        await showOverlayWindow(payload, syncId, canApplySync);
      } catch (error) {
        if (!disposed) console.error("Failed to sync desktop timer overlay", error);
      }
    };

    void syncOverlay();
    return () => {
      disposed = true;
    };
  }, [payload]);

  useEffect(() => {
    if (!isTauriRuntime() || !hasPayload) return undefined;
    let disposed = false;
    let restoreInFlight = false;

    const restoreOverlay = () => {
      const latestPayload = payloadRef.current;
      if (!latestPayload || restoreInFlight) return;
      restoreInFlight = true;
      void showOverlayWindow(latestPayload, syncSequenceRef.current)
        .catch((error) => {
          if (!disposed) console.error("Failed to recover desktop timer overlay", error);
        })
        .finally(() => {
          restoreInFlight = false;
        });
    };

    const restoreInterval = window.setInterval(restoreOverlay, 1500);
    return () => {
      disposed = true;
      window.clearInterval(restoreInterval);
    };
  }, [hasPayload]);

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const attach = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const removeToggle = await listen(DESKTOP_TIMER_TOGGLE_EVENT, toggleTimer, {
        target: { kind: "WebviewWindow", label: "main" },
      });
      const removeAbort = await listen(DESKTOP_TIMER_ABORT_EVENT, abortTimer, {
        target: { kind: "WebviewWindow", label: "main" },
      });
      const removeReady = await listen(DESKTOP_TIMER_READY_EVENT, () => {
        const latestPayload = payloadRef.current;
        if (latestPayload) {
          void showOverlayWindow(latestPayload, syncSequenceRef.current).catch((error) => {
            console.error("Failed to restore desktop timer overlay", error);
          });
        }
      }, {
        target: { kind: "WebviewWindow", label: "main" },
      });

      if (disposed) {
        removeToggle();
        removeAbort();
        removeReady();
        return;
      }
      unlisteners.push(removeToggle, removeAbort, removeReady);
    };

    void attach().catch((error) => {
      if (!disposed) console.error("Failed to attach desktop timer overlay listeners", error);
    });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [abortTimer, toggleTimer]);
}
