import { CheckCircle2 } from "lucide-react";
import { labelPriority, labelTaskStage } from "../../appModel";
import type { ProjectMember, Task } from "../../types";

function formatAcceptedAt(iso?: string) {
  if (!iso) return "未记录验收时间";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "验收时间异常";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ProjectAcceptedTasksPanel(props: {
  tasks: Task[];
  members: ProjectMember[];
  selectTask: (taskId: string) => void;
}) {
  const membersById = new Map(props.members.map((member) => [member.id, member]));

  return (
    <section className="band project-accepted-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">验收归档</p>
          <h2>验收通过</h2>
        </div>
        <span className="count-pill">{props.tasks.length}</span>
      </div>
      {props.tasks.length === 0 && <p className="empty">当前项目还没有验收通过的任务。</p>}
      {props.tasks.length > 0 && (
        <div className="project-accepted-list">
          {props.tasks.map((task) => {
            const executorName = task.primaryExecutorMemberId ? membersById.get(task.primaryExecutorMemberId)?.name ?? "已分配" : "未分配";
            return (
              <button className="project-accepted-card" key={task.id} onClick={() => props.selectTask(task.id)} type="button">
                <span className="accepted-icon">
                  <CheckCircle2 size={18} />
                </span>
                <div className="project-accepted-main">
                  <strong>{task.title}</strong>
                  <span>{executorName} · {labelTaskStage[task.stage]} · {labelPriority[task.priority]} · {task.actualPomodoros}/{task.estimatePomodoros} 番茄</span>
                </div>
                <div className="project-accepted-time">
                  <span>验收时间</span>
                  <strong>{formatAcceptedAt(task.reviewAcceptedAt)}</strong>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
