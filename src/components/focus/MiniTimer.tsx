import { Pause, Play, Square } from "lucide-react";
import { formatTime, modeLabel } from "../../appModel";
import type { AppState, SessionOutcome, Task } from "../../types";
import { PomodoroProgress } from "./PomodoroProgress";
import { useMiniTimerDrag } from "./useMiniTimerDrag";
import { platformCapabilities } from "../../platformCapabilities";

export function MiniTimer(props: {
  state: AppState;
  task?: Task;
  toggleTimer: () => void;
  finishTimer: (outcome: SessionOutcome) => Promise<void>;
}) {
  const miniTimerDrag = useMiniTimerDrag();
  const mobile = platformCapabilities().isMobile;
  const active = props.state.activeTimer;

  if (!active) return null;

  const progress = 100 - (active.remaining / active.duration) * 100;
  return (
    <aside
      className={miniTimerDrag.dragging ? "mini-timer-panel dragging" : "mini-timer-panel"}
      aria-label="迷你计时器"
      onPointerCancel={mobile ? undefined : miniTimerDrag.cancelDragPress}
      onPointerDown={mobile ? undefined : miniTimerDrag.beginDragPress}
      onPointerMove={mobile ? undefined : miniTimerDrag.moveDragPress}
      onPointerUp={mobile ? undefined : miniTimerDrag.finishDragPress}
      ref={miniTimerDrag.panelRef}
      style={!mobile && miniTimerDrag.position ? { left: miniTimerDrag.position.x, top: miniTimerDrag.position.y, right: "auto", bottom: "auto" } : undefined}
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
