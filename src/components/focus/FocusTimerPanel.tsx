import { Check, CirclePause, CirclePlay, Leaf, ListChecks, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { formatTime, modeLabel } from "../../appModel";
import type { ActiveTimer, InterruptionAction, InterruptionType, SessionMode, SessionOutcome, Task } from "../../types";
import { displayRemainingForTimer } from "./focusModel";
import { PomodoroProgress } from "./PomodoroProgress";

export function FocusTimerPanel(props: {
  active?: ActiveTimer;
  currentTask?: Task;
  committedTasks: Task[];
  focusMinutes: number;
  progress: number;
  upcomingBreakMode: SessionMode;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  resetTimer: () => void;
  finishTimer: (outcome: SessionOutcome) => Promise<void>;
  addInterruption: (type: InterruptionType, action?: InterruptionAction) => void;
}) {
  const { active, currentTask } = props;
  const [, setDisplayTick] = useState(0);
  const displayRemaining = active ? displayRemainingForTimer(active) : 0;
  const displayProgress = active ? 100 - (displayRemaining / active.duration) * 100 : props.progress;

  useEffect(() => {
    if (!active?.isRunning) return;
    const tick = window.setInterval(() => setDisplayTick((value) => value + 1), 250);
    return () => window.clearInterval(tick);
  }, [active?.sessionId, active?.plannedEndAt, active?.isRunning]);

  return (
    <div className="focus-timer-panel">
      <div className="focus-orbit" style={{ background: `conic-gradient(#1f9d8a ${displayProgress}%, #e7e1d8 ${displayProgress}% 100%)` }}>
        <div className="timer-face">
          <p>{active ? modeLabel[active.mode] : "准备开始"}</p>
          <strong>{active ? formatTime(displayRemaining) : `${props.focusMinutes}:00`}</strong>
          <span>{currentTask?.title ?? "从我的任务选择一个任务"}</span>
          {currentTask && <PomodoroProgress actual={currentTask.actualPomodoros} estimate={currentTask.estimatePomodoros} compact />}
        </div>
      </div>

      <div className="timer-controls">
        {!active ? (
          <button
            className="primary-button large"
            onClick={() => void props.beginTimer("focus", currentTask?.id ?? props.committedTasks[0]?.id)}
            disabled={!currentTask && props.committedTasks.length === 0}
          >
            <CirclePlay size={18} />
            开始工作
          </button>
        ) : (
          <>
            <button className="primary-button large" onClick={props.toggleTimer}>
              {active.isRunning ? <Pause size={18} /> : <Play size={18} />}
              {active.isRunning ? "暂停" : "继续"}
            </button>
            <button className="secondary-button large" onClick={props.resetTimer}>
              <RotateCcw size={18} />
              重置
            </button>
            <button className="secondary-button large" onClick={() => void props.finishTimer("aborted")}>
              <Square size={18} />
              作废
            </button>
          </>
        )}
      </div>

      <div className="mode-switcher">
        <button onClick={() => void props.beginTimer("short_break")}>
          <CirclePause size={16} />
          短休息
        </button>
        <button onClick={() => void props.beginTimer(props.upcomingBreakMode)}>
          <Leaf size={16} />
          阶段休息
        </button>
        {active?.mode === "focus" && (
          <>
            <button onClick={() => props.addInterruption("internal", "defer")}>
              <CirclePause size={16} />
              内部中断
            </button>
            <button onClick={() => props.addInterruption("external", "inbox")}>
              <ListChecks size={16} />
              外部中断
            </button>
            <button onClick={() => void props.finishTimer("completed")}>
              <Check size={16} />
              完成一段工作
            </button>
          </>
        )}
      </div>
    </div>
  );
}
