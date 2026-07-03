import { nowIso } from "./appModel";
import { uid } from "./seed";
import type { AppState, Interruption, InterruptionAction, InterruptionType } from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;
type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppFocusInterruptionRuntimeOptions = {
  getState: () => AppState;
  getQuickNote: () => string;
  updateState: UpdateState;
  setQuickNote: Setter<string>;
  setToast: (message: string) => void;
};

export type AppFocusInterruptionRuntime = {
  addInterruption: (type: InterruptionType, action?: InterruptionAction) => void;
};

export function createAppFocusInterruptionRuntime({
  getState,
  getQuickNote,
  updateState,
  setQuickNote,
  setToast,
}: AppFocusInterruptionRuntimeOptions): AppFocusInterruptionRuntime {
  const addInterruption = (type: InterruptionType, action: InterruptionAction = "defer") => {
    const state = getState();
    const active = state.activeTimer;
    const timestamp = nowIso();
    const interruption: Interruption = {
      id: uid("interrupt"),
      workspaceId: active?.taskId ? state.tasks.find((task) => task.id === active.taskId)?.workspaceId : state.auth.workspace?.id,
      sessionId: active?.sessionId,
      taskId: active?.taskId,
      type,
      note: getQuickNote().trim() || (type === "internal" ? "突然想做其他事" : "外部请求/消息打断"),
      action,
      createdAt: timestamp,
    };

    updateState((value) => ({
      ...value,
      interruptions: [interruption, ...value.interruptions],
      focusSessions: active
        ? value.focusSessions.map((session) =>
            session.id === active.sessionId
              ? {
                  ...session,
                  interruptionCounts: {
                    ...session.interruptionCounts,
                    [type]: session.interruptionCounts[type] + 1,
                  },
                }
              : session,
          )
        : value.focusSessions,
      updatedAt: timestamp,
    }));
    setQuickNote("");
    setToast(type === "internal" ? "已记录内部中断，继续当前番茄" : "已记录外部中断，稍后答复");
  };

  return { addInterruption };
}
