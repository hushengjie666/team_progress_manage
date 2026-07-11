import { useEffect } from "react";
import { syncNativeTimer } from "./nativeTimerBridge";
import type { AppState, Task } from "./types";

export function useNativeTimerSync(state: AppState | null, currentTask?: Task) {
  const active = state?.activeTimer;
  useEffect(() => {
    void syncNativeTimer(active, currentTask).catch((error) => {
      console.error("Failed to synchronize native timer", error);
    });
  }, [active?.sessionId, active?.isRunning, active?.plannedEndAt, active?.pausedAt, currentTask?.id, currentTask?.title]);
}
