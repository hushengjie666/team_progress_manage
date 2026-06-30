import { ListChecks, Play } from "lucide-react";
import { projectToneClassName } from "../../projectVisuals";
import type { SessionMode } from "../../types";
import type { FocusTaskGroup } from "./focusModel";

export function FocusTaskList(props: {
  groups: FocusTaskGroup[];
  taskCount: number;
  activeTaskId?: string;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
}) {
  return (
    <section className="band focus-todo-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">今日工作</p>
          <h2>待办清单</h2>
        </div>
        <ListChecks size={20} />
      </div>
      <div className="focus-todo-list">
        {props.taskCount === 0 && <p className="empty">今日工作队列为空，先去我的任务选择要推进的任务。</p>}
        {props.groups.map((group) => (
          <section className={`focus-project-group ${projectToneClassName(group.projectId)}`} key={group.projectId}>
            <div className="focus-project-heading">
              <strong>{group.project}</strong>
              <span>{group.tasks.length}</span>
            </div>
            <div className="focus-project-tasks">
              {group.tasks.map((task) => {
                const isActive = task.id === props.activeTaskId;
                return (
                  <article className={isActive ? "focus-todo-item active" : "focus-todo-item"} key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.actualPomodoros}/{task.estimatePomodoros} 番茄 · {task.progressPercent ?? 0}%</span>
                    </div>
                    {isActive ? (
                      <span className="running-pill">执行中</span>
                    ) : (
                      <button className="small-button" onClick={() => void props.beginTimer("focus", task.id)}>
                        <Play size={14} />
                        开始
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
