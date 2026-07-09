import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Pause, Play, Square } from "lucide-react";
import { formatTime, modeLabel } from "./appModel";
import {
  DESKTOP_TIMER_ABORT_EVENT,
  DESKTOP_TIMER_ENDED_EVENT,
  DESKTOP_TIMER_READY_EVENT,
  DESKTOP_TIMER_STATE_EVENT,
  DESKTOP_TIMER_TOGGLE_EVENT,
} from "./desktopTimerOverlay";
import {
  displayRemainingForDesktopTimer,
  shouldApplyDesktopTimerPayload,
  type DesktopTimerEndPayload,
  type DesktopTimerPayload,
} from "./desktopTimerPayload";
import { writeStoredDesktopTimerWindowPosition } from "./desktopTimerWindowPosition";
import { playTimerSound } from "./notifications";
import { isTauriRuntime } from "./tauriEnvironment";
import { PomodoroProgress } from "./components/focus/PomodoroProgress";
import { normalizeTimerSpeedMultiplier } from "./timerSpeed";

const CONTROL_SELECTOR = "button";

export function TimerOverlayApp() {
  const [payload, setPayload] = useState<DesktopTimerPayload | null>(null);
  const [now, setNow] = useState(() => new Date());
  const overlayPressRef = useRef({ started: false, moved: false });
  const announcedEndRef = useRef<string | null>(null);

  const playEndSoundOnce = (eventPayload: DesktopTimerEndPayload) => {
    const endKey = `${eventPayload.sessionId}:${eventPayload.mode}`;
    if (announcedEndRef.current === endKey) return;
    announcedEndRef.current = endKey;
    playTimerSound(eventPayload);
  };

  useEffect(() => {
    document.body.classList.add("timer-overlay-body");
    return () => document.body.classList.remove("timer-overlay-body");
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const attach = async () => {
      const { emitTo, listen } = await import("@tauri-apps/api/event");
      const removeState = await listen<DesktopTimerPayload>(DESKTOP_TIMER_STATE_EVENT, (event) => {
        setPayload((current) => (
          shouldApplyDesktopTimerPayload(current, event.payload) ? event.payload : current
        ));
      });
      const removeEnded = await listen<DesktopTimerEndPayload>(DESKTOP_TIMER_ENDED_EVENT, (event) => {
        playEndSoundOnce(event.payload);
      });
      unlisteners.push(removeState, removeEnded);
      await emitTo("main", DESKTOP_TIMER_READY_EVENT);
    };

    void attach().catch((error) => {
      if (!disposed) console.error("Failed to attach timer overlay listener", error);
    });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!payload?.isRunning) {
      setNow(new Date());
      return undefined;
    }
    const intervalDelay = normalizeTimerSpeedMultiplier(payload.speedMultiplier) > 1 ? 250 : 1000;
    const interval = window.setInterval(() => setNow(new Date()), intervalDelay);
    return () => window.clearInterval(interval);
  }, [payload?.isRunning, payload?.plannedEndAt, payload?.sessionId, payload?.speedMultiplier]);

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const attach = async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();
      const savePosition = async () => {
        const position = await currentWindow.outerPosition();
        writeStoredDesktopTimerWindowPosition({ x: position.x, y: position.y });
      };
      const removeMoveListener = await currentWindow.listen("tauri://move", () => {
        if (overlayPressRef.current.started) overlayPressRef.current.moved = true;
        void savePosition();
      });

      if (disposed) {
        removeMoveListener();
        return;
      }
      unlisteners.push(removeMoveListener);
    };

    void attach().catch((error) => {
      if (!disposed) console.error("Failed to attach timer overlay move listener", error);
    });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  const remaining = payload ? displayRemainingForDesktopTimer(payload, now) : 0;
  const progress = payload ? 100 - (remaining / payload.duration) * 100 : 0;
  const hasPomodoro = payload?.actualPomodoros !== undefined && payload.estimatePomodoros !== undefined;

  useEffect(() => {
    if (!payload?.isRunning || remaining > 0) return;
    playEndSoundOnce(payload);
  }, [
    payload?.sessionId,
    payload?.mode,
    payload?.isRunning,
    payload?.soundEnabled,
    payload?.timerEndSound,
    payload?.timerEndSoundVolume,
    payload?.timerEndSoundRepeats,
    remaining,
  ]);

  const progressStyle = useMemo(
    () => ({ width: `${Math.min(100, Math.max(0, progress))}%` }),
    [progress],
  );

  const restoreMainWindow = async () => {
    if (!isTauriRuntime()) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("restore_main_window_command");
  };

  const startDragging = async (event: React.PointerEvent<HTMLElement>) => {
    if (!isTauriRuntime()) return;
    if ((event.target as Element).closest(CONTROL_SELECTOR)) return;
    event.preventDefault();
    overlayPressRef.current = { started: true, moved: false };
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  };

  const handleOverlayClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest(CONTROL_SELECTOR)) return;
    if (overlayPressRef.current.moved) {
      overlayPressRef.current = { started: false, moved: false };
      return;
    }
    overlayPressRef.current = { started: false, moved: false };
    void restoreMainWindow().catch((error) => console.error("Failed to restore main window", error));
  };

  const emitControl = async (eventName: string) => {
    if (!isTauriRuntime()) return;
    const { emitTo } = await import("@tauri-apps/api/event");
    await emitTo("main", eventName);
  };

  if (!payload) {
    return <div className="timer-overlay-root" />;
  }

  return (
    <main
      className="timer-overlay-root"
      onClick={handleOverlayClick}
      onPointerDown={(event) => void startDragging(event)}
    >
      <section className="timer-overlay-panel" aria-label="桌面计时器">
        <div className="timer-overlay-content">
          <p>{modeLabel[payload.mode]}</p>
          <strong>{formatTime(remaining)}</strong>
          <span>{payload.taskTitle ?? "无任务计时"}</span>
          {hasPomodoro && (
            <PomodoroProgress
              actual={payload.actualPomodoros!}
              estimate={payload.estimatePomodoros!}
              compact
            />
          )}
        </div>
        <div className="timer-overlay-actions">
          <button
            className="icon-button small"
            title={payload.isRunning ? "暂停" : remaining === payload.duration ? "开始" : "继续"}
            onClick={() => void emitControl(DESKTOP_TIMER_TOGGLE_EVENT)}
          >
            {payload.isRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            className="icon-button small danger"
            title="作废番茄"
            onClick={() => void emitControl(DESKTOP_TIMER_ABORT_EVENT)}
          >
            <Square size={14} />
          </button>
        </div>
        <div className="timer-overlay-progress">
          <span style={progressStyle} />
        </div>
      </section>
    </main>
  );
}
