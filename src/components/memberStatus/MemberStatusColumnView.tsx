import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { labelTaskStage } from "../../appModel";
import type { MemberProjectTaskGroup, MemberStatusColumn } from "../../memberStatusTypes";
import { stageTaskStatusLabel } from "../../projectTaskDisplay";
import { projectToneClassName } from "../../projectVisuals";
import type { Task } from "../../types";

type MemberStatusColumnViewProps = {
  member: MemberStatusColumn;
  selectTask: (taskId: string | null) => void;
};

const taskStatusIcon = (task: Task) => {
  if (task.status === "pending_review") {
    return { label: "待验收", className: "review", icon: <ClipboardCheck aria-hidden="true" size={16} /> };
  }
  if (task.status === "completed") {
    return { label: "已完成", className: "completed", icon: <CheckCircle2 aria-hidden="true" size={16} /> };
  }
  return undefined;
};

function MemberProjectTaskGroupView({
  group,
  runningTaskId,
  selectTask,
}: {
  group: MemberProjectTaskGroup;
  runningTaskId?: string;
  selectTask: (taskId: string | null) => void;
}) {
  return (
    <section
      className={[
        "member-project-task-group",
        projectToneClassName(group.projectId),
      ].filter(Boolean).join(" ")}
      key={group.projectId}
    >
      <div className="member-project-task-heading">
        <div className="member-project-title">
          <strong>{group.projectName}</strong>
          {group.workspaceName && <span className="member-project-workspace">{group.workspaceName}</span>}
          <span className="member-project-role">{group.roleLabel}</span>
        </div>
        <span className="member-project-count">{group.tasks.length}</span>
      </div>
      <div className="member-project-task-list">
        {group.tasks.map((task) => {
          const isRunning = task.id === runningTaskId;
          const statusIcon = taskStatusIcon(task);
          return (
            <button
              className={[
                "member-task-item",
                isRunning ? "running" : "",
                statusIcon ? `status-${statusIcon.className}` : "",
              ].filter(Boolean).join(" ")}
              key={task.id}
              onClick={() => selectTask(task.id)}
            >
              <span className="member-task-copy">
                <span className="member-task-title-row">
                  <strong>{task.title}</strong>
                  {isRunning && <span className="member-task-state">执行中</span>}
                </span>
                <span className="member-task-meta">{stageTaskStatusLabel(task.status)} · {labelTaskStage[task.stage]} · {task.progressPercent ?? 0}%</span>
              </span>
              {statusIcon && (
                <span className={`member-task-status-icon ${statusIcon.className}`} title={statusIcon.label} aria-label={statusIcon.label}>
                  {statusIcon.icon}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function MemberStatusColumnView({ member, selectTask }: MemberStatusColumnViewProps) {
  return (
    <article className="member-status-column">
      <div className="member-status-heading">
        <div>
          <strong>{member.name}</strong>
        </div>
        <span>{member.displayedTasks.length}</span>
      </div>
      <div className="member-task-list">
        {member.projectTaskGroups.map((group) => (
          <MemberProjectTaskGroupView
            group={group}
            key={group.projectId}
            runningTaskId={member.runningTask?.id}
            selectTask={selectTask}
          />
        ))}
        {member.displayedTasks.length === 0 && <p className="empty">今日没有项目任务。</p>}
      </div>
    </article>
  );
}
