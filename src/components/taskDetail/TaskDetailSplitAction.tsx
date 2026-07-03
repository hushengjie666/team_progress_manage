import { Split } from "lucide-react";
import type { Task } from "../../types";

type TaskDetailSplitActionProps = {
  task: Task;
  canEdit: boolean;
  splitTask: (taskId: string) => void;
};

export function TaskDetailSplitAction({ task, canEdit, splitTask }: TaskDetailSplitActionProps) {
  if (task.status === "completed" || task.status === "split" || task.status === "archived") return null;

  return (
    <button className="primary-button" disabled={!canEdit} onClick={() => splitTask(task.id)}>
      <Split size={16} />
      {task.estimatePomodoros > 7 ? "拆分大任务" : "拆分任务"}
    </button>
  );
}
