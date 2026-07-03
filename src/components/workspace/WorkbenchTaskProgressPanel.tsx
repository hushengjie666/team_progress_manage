import { labelPriority } from "../../appModel";
import type { Task } from "../../types";

type WorkbenchTaskProgressPanelProps = {
  task: Task;
};

export function WorkbenchTaskProgressPanel({ task }: WorkbenchTaskProgressPanelProps) {
  return (
    <div className="task-progress-panel">
      <div className="task-progress-heading">
        <span className={`priority priority-${task.priority}`}>{labelPriority[task.priority]}</span>
        <span className="task-progress-numbers">
          <strong>{task.progressPercent ?? 0}%</strong>
          <span>{task.actualPomodoros}/{task.estimatePomodoros} 番茄</span>
        </span>
      </div>
      <TaskProgressBar percent={task.progressPercent ?? 0} compact showValue={false} />
    </div>
  );
}

function TaskProgressBar({ percent, compact = false, showValue = true }: { percent: number; compact?: boolean; showValue?: boolean }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="task-progress-bar" aria-label={`任务进度 ${safe}%`}>
      <span style={{ width: `${safe}%` }} />
      {showValue && !compact && <strong>{safe}%</strong>}
      {showValue && compact && <em>{safe}%</em>}
    </div>
  );
}
