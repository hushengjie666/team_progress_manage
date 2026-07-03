import { Check } from "lucide-react";
import { labelTaskStage } from "../../appModel";
import type { Task } from "../../types";

export function WorkbenchTaskSummary({
  task,
  isPausedTask,
}: {
  task: Task;
  isPausedTask: boolean;
}) {
  const visibleTags = task.tags.filter((tag) => tag !== task.project && tag !== labelTaskStage[task.stage]);
  const visibleNotes = task.notes.startsWith("由「") && task.notes.endsWith("」拆分而来。") ? "" : task.notes;

  return (
    <div className="task-main">
      <div className="task-title-row">
        <div className="task-title-main">
          <strong>{task.title}</strong>
        </div>
        <div className="task-title-badges">
          {task.status === "pending_review" && (
            <span className="task-state-chip review-state">
              <Check size={13} />
              待验收
            </span>
          )}
          {task.status === "completed" && <span className="task-state-chip">已完成</span>}
          {task.status === "archived" && <span className="task-state-chip">已归档</span>}
          {task.status === "split" && <span className="task-state-chip">已拆分</span>}
          {isPausedTask && <span className="status-pill">已暂停</span>}
        </div>
      </div>
      <div className="task-meta-strip">
        <span className="task-inline-chip">{task.project}</span>
        <span className="task-inline-chip">{labelTaskStage[task.stage]}</span>
        {visibleTags.slice(0, 2).map((tag) => (
          <span className="task-inline-chip muted-chip" key={tag}>
            {tag}
          </span>
        ))}
        {visibleTags.length > 2 && <span className="task-inline-chip muted-chip">+{visibleTags.length - 2}</span>}
        {task.dueAt && <span className="task-inline-chip muted-chip">到期 {new Date(task.dueAt).toLocaleDateString()}</span>}
        {task.severity === "very_high" && <span className="task-inline-chip danger-chip">高严重度</span>}
      </div>
      {visibleNotes && (
        <div className="task-summary-line">
          <p>{visibleNotes}</p>
        </div>
      )}
    </div>
  );
}
