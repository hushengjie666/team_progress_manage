import type { ProjectMember, Task } from "../../types";

type TaskDetailProgressSectionProps = {
  task: Task;
  executors: ProjectMember[];
  canEdit: boolean;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: { primaryExecutorMemberId?: string }) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
};

export function TaskDetailProgressSection({
  task,
  executors,
  canEdit,
  updateTask,
  updateTaskAssignment,
  updateTaskProgress,
}: TaskDetailProgressSectionProps) {
  return (
    <div className="detail-section">
      <div className="detail-section-heading">
        <strong>执行与进展</strong>
        <span>谁负责、做了多少、现在卡在哪里。</span>
      </div>
      <div className="detail-grid">
        <label>
          主执行人
          <select
            value={task.primaryExecutorMemberId ?? ""}
            disabled={!canEdit}
            onChange={(event) => updateTaskAssignment(task.id, { primaryExecutorMemberId: event.target.value })}
          >
            <option value="">未分配</option>
            {executors.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>
        <label>
          进度百分比
          <input
            type="number"
            min="0"
            max="100"
            value={task.progressPercent ?? 0}
            disabled={!canEdit}
            onChange={(event) => updateTaskProgress(task.id, Number(event.target.value), task.progressNote ?? "")}
          />
        </label>
        <label>
          估算番茄
          <input
            type="number"
            min="0"
            max="30"
            value={task.estimatePomodoros}
            disabled={!canEdit}
            onChange={(event) => updateTask(task.id, { estimatePomodoros: Number(event.target.value) })}
          />
        </label>
        <label>
          实际番茄
          <input
            type="number"
            min="0"
            value={task.actualPomodoros}
            disabled={!canEdit}
            onChange={(event) => updateTask(task.id, { actualPomodoros: Number(event.target.value) })}
          />
        </label>
        <label className="span-2">
          进展说明
          <textarea
            value={task.progressNote ?? ""}
            disabled={!canEdit}
            onChange={(event) => updateTaskProgress(task.id, task.progressPercent ?? 0, event.target.value)}
            placeholder="说明刚完成了什么、还剩什么，或为什么偏离预期"
          />
        </label>
      </div>
    </div>
  );
}
