import { AlarmClock, Check } from "lucide-react";
import { estimateDeltaLabel } from "../../domain";
import type { Task } from "../../types";

type TaskDetailSummaryProps = {
  task: Task;
};

export function TaskDetailSummary({ task }: TaskDetailSummaryProps) {
  const completedSubtasks = (task.subtasks ?? []).filter((subtask) => subtask.completed).length;

  return (
    <div className="detail-summary">
      <Metric icon={<Check size={17} />} label="子任务" value={`${completedSubtasks}/${task.subtasks.length}`} />
      <Metric icon={<AlarmClock size={17} />} label="偏差" value={estimateDeltaLabel(task.estimatePomodoros, task.actualPomodoros)} />
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
