import { taskStageOptions } from "../../appModel";
import type { AppState, Priority, Severity, Task, TaskStage } from "../../types";

type TaskDetailBasicInfoSectionProps = {
  task: Task;
  projects: AppState["projects"];
  taskProject?: AppState["projects"][number];
  canEdit: boolean;
  lockProject?: boolean;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (
    taskId: string,
    assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] },
  ) => void;
};

export function TaskDetailBasicInfoSection({
  task,
  projects,
  taskProject,
  canEdit,
  lockProject,
  updateTask,
  updateTaskAssignment,
}: TaskDetailBasicInfoSectionProps) {
  return (
    <div className="detail-section">
      <div className="detail-section-heading">
        <strong>基本信息</strong>
        <span>任务是什么、属于哪个项目、优先级如何。</span>
      </div>
      <div className="detail-grid">
        <label className="span-2">
          标题
          <input value={task.title} disabled={!canEdit} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
        </label>
        <label>
          项目
          {lockProject ? (
            <input value={taskProject?.name ?? "未命名项目"} disabled />
          ) : (
            <select
              value={taskProject?.id ?? ""}
              disabled={!canEdit}
              onChange={(event) =>
                updateTaskAssignment(task.id, {
                  projectId: event.target.value,
                  primaryExecutorMemberId: "",
                  collaboratorMemberIds: [],
                })
              }
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          )}
        </label>
        <label>
          标签
          <input
            value={task.tags.join(", ")}
            disabled={!canEdit}
            onChange={(event) =>
              updateTask(task.id, {
                tags: event.target.value
                  .split(/[,\s，]+/)
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label>
          优先级
          <select value={task.priority} disabled={!canEdit} onChange={(event) => updateTask(task.id, { priority: event.target.value as Priority })}>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </label>
        <label>
          阶段
          <select value={task.stage} disabled={!canEdit} onChange={(event) => updateTask(task.id, { stage: event.target.value as TaskStage })}>
            {taskStageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          严重度
          <select value={task.severity} disabled={!canEdit} onChange={(event) => updateTask(task.id, { severity: event.target.value as Severity })}>
            <option value="very_high">非常高</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </label>
        <label className="span-2">
          备注
          <textarea value={task.notes} disabled={!canEdit} onChange={(event) => updateTask(task.id, { notes: event.target.value })} />
        </label>
      </div>
    </div>
  );
}
