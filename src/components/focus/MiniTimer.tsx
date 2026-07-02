import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Pause, Play, Square } from "lucide-react";
import { formatTime, modeLabel } from "../../appModel";
import type { AppState, SessionOutcome, Task } from "../../types";
import { PomodoroProgress } from "./PomodoroProgress";

type MiniTimerPosition = {
  x: number;
  y: number;
};

type MiniTimerPressState = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  active: boolean;
};

const MINI_TIMER_POSITION_STORAGE_KEY = "timemanage.miniTimerPosition.v1";
const MINI_TIMER_LONG_PRESS_MS = 180;
const MINI_TIMER_MOUSE_DRAG_START_PX = 6;
const MINI_TIMER_TOUCH_SCROLL_CANCEL_PX = 16;
const MINI_TIMER_EDGE_GAP = 10;

const readStoredMiniTimerPosition = (): MiniTimerPosition | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MINI_TIMER_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<MiniTimerPosition>;
    return Number.isFinite(value.x) && Number.isFinite(value.y)
      ? { x: value.x!, y: value.y! }
      : null;
  } catch {
    return null;
  }
};

const writeStoredMiniTimerPosition = (position: MiniTimerPosition) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MINI_TIMER_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Dragging should still work for the current session when localStorage is unavailable.
  }
};

const clampMiniTimerPosition = (
  position: MiniTimerPosition,
  width: number,
  height: number,
): MiniTimerPosition => {
  if (typeof window === "undefined") return position;
  const maxX = Math.max(MINI_TIMER_EDGE_GAP, window.innerWidth - width - MINI_TIMER_EDGE_GAP);
  const maxY = Math.max(MINI_TIMER_EDGE_GAP, window.innerHeight - height - MINI_TIMER_EDGE_GAP);
  return {
    x: Math.min(Math.max(MINI_TIMER_EDGE_GAP, position.x), maxX),
    y: Math.min(Math.max(MINI_TIMER_EDGE_GAP, position.y), maxY),
  };
};

export function MiniTimer(props: {
  state: AppState;
  task?: Task;
  toggleTimer: () => void;
  finishTimer: (outcome: SessionOutcome) => Promise<void>;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const longPressTimerRef = useRef<number | undefined>(undefined);
  const pressRef = useRef<MiniTimerPressState | null>(null);
  const [position, setPosition] = useState<MiniTimerPosition | null>(() => readStoredMiniTimerPosition());
  const [dragging, setDragging] = useState(false);
  const active = props.state.activeTimer;

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== undefined) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  };

  const positionFromPointer = (press: MiniTimerPressState, clientX: number, clientY: number) => {
    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 360;
    const height = panel?.offsetHeight ?? 160;
    return clampMiniTimerPosition({ x: clientX - press.offsetX, y: clientY - press.offsetY }, width, height);
  };

  const activateDrag = (press: MiniTimerPressState, clientX = press.startX, clientY = press.startY) => {
    if (press.active) return;
    press.active = true;
    clearLongPressTimer();
    setDragging(true);
    setPosition(positionFromPointer(press, clientX, clientY));
  };

  const beginDragPress = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const press: MiniTimerPressState = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      active: false,
    };
    pressRef.current = press;
    event.currentTarget.setPointerCapture(event.pointerId);
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      if (pressRef.current?.pointerId === event.pointerId) activateDrag(pressRef.current);
    }, MINI_TIMER_LONG_PRESS_MS);
  };

  const moveDragPress = (event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (!press.active) {
      if (press.pointerType === "mouse" && distance > MINI_TIMER_MOUSE_DRAG_START_PX) {
        activateDrag(press, event.clientX, event.clientY);
      } else if (press.pointerType !== "mouse" && distance > MINI_TIMER_TOUCH_SCROLL_CANCEL_PX) {
        clearLongPressTimer();
        pressRef.current = null;
        return;
      } else {
        return;
      }
    }
    event.preventDefault();
    setPosition(positionFromPointer(press, event.clientX, event.clientY));
  };

  const finishDragPress = (event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    clearLongPressTimer();
    pressRef.current = null;
    setDragging(false);
    if (press.active) {
      const finalPosition = positionFromPointer(press, event.clientX, event.clientY);
      setPosition(finalPosition);
      writeStoredMiniTimerPosition(finalPosition);
    }
  };

  const cancelDragPress = () => {
    clearLongPressTimer();
    pressRef.current = null;
    setDragging(false);
  };

  useEffect(() => () => clearLongPressTimer(), []);

  useEffect(() => {
    if (!position) return;
    const handleResize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      setPosition((current) => {
        if (!current) return current;
        const next = clampMiniTimerPosition(current, panel.offsetWidth, panel.offsetHeight);
        writeStoredMiniTimerPosition(next);
        return next;
      });
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [position !== null]);

  if (!active) return null;

  const progress = 100 - (active.remaining / active.duration) * 100;
  return (
    <aside
      className={dragging ? "mini-timer-panel dragging" : "mini-timer-panel"}
      aria-label="迷你计时器"
      onPointerCancel={cancelDragPress}
      onPointerDown={beginDragPress}
      onPointerMove={moveDragPress}
      onPointerUp={finishDragPress}
      ref={panelRef}
      style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}
    >
      <div>
        <p>{modeLabel[active.mode]}</p>
        <strong>{formatTime(active.remaining)}</strong>
        <span>{props.task?.title ?? "无任务计时"}</span>
        {props.task && <PomodoroProgress actual={props.task.actualPomodoros} estimate={props.task.estimatePomodoros} compact />}
      </div>
      <div className="mini-timer-progress">
        <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
      <div className="mini-timer-actions">
        <button className="icon-button small" title={active.isRunning ? "暂停" : "继续"} onClick={props.toggleTimer}>
          {active.isRunning ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button className="icon-button small danger" title="作废番茄" onClick={() => void props.finishTimer("aborted")}>
          <Square size={15} />
        </button>
      </div>
    </aside>
  );
}
