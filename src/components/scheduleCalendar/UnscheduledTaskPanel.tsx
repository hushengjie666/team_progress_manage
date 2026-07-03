import { labelTaskStage } from "../../appModel";
import { scheduleMemberName } from "../../scheduleCalendar";
import type { ProjectMember, Task } from "../../types";

type UnscheduledTaskPanelProps = {
  tasks: Task[];
  members: ProjectMember[];
  openTask: (taskId: string) => void;
};

export function UnscheduledTaskPanel({
  tasks,
  members,
  openTask,
}: UnscheduledTaskPanelProps) {
  return (
    <section className="band unscheduled-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">未排期任务</p>
          <h2>还没有开始/完成日期</h2>
        </div>
        <span className="count-pill">{tasks.length}</span>
      </div>
      <div className="unscheduled-task-grid">
        {tasks.map((task) => (
          <button className="unscheduled-task-card" key={task.id} onClick={() => openTask(task.id)} type="button">
            <strong>{task.title}</strong>
            <span>{task.project} · {labelTaskStage[task.stage]} · {scheduleMemberName(members, task.primaryExecutorMemberId)}</span>
          </button>
        ))}
        {tasks.length === 0 && <p className="empty">所有任务都已经有排期。</p>}
      </div>
    </section>
  );
}
