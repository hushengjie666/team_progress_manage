import { CheckCircle2, Play, Plus } from "lucide-react";
import { projectToneClassName } from "../../projectVisuals";
import type { SessionMode } from "../../types";
import type { FocusTaskGroup } from "./focusModel";

export function FocusTaskList(props: {
  groups: FocusTaskGroup[];
  taskCount: number;
  activeTaskId?: string;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  openCreateTask: () => void;
  canCreateTask: boolean;
}) {
  return (
    <section className="band focus-todo-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">今日工作</p>
          <h2>今日任务</h2>
        </div>
        <button className="icon-button small" title={props.canCreateTask ? "快捷新增今日任务" : "暂无可用项目，请先创建项目"} aria-label="快捷新增今日任务" disabled={!props.canCreateTask} onClick={props.openCreateTask}>
          <Plus size={20} />
        </button>
      </div>
      <div className="focus-todo-list">
        {props.taskCount === 0 && <p className="empty">今日任务为空，可点击右上角新增任务，或去我的任务选择要推进的任务。</p>}
        {props.groups.map((group) => (
          <section className={`focus-project-group ${projectToneClassName(group.projectId)}`} key={group.projectId}>
            <div className="focus-project-heading">
              <strong>{group.project}</strong>
              <span>{group.tasks.length}</span>
            </div>
            <div className="focus-project-tasks">
              {group.tasks.map((task) => {
                const isActive = task.id === props.activeTaskId;
                const isPendingReview = task.status === "pending_review";
                const isCompleted = task.status === "completed";
                return (
                  <article className={isActive ? "focus-todo-item active" : "focus-todo-item"} key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.actualPomodoros}/{task.estimatePomodoros} 番茄 · {task.progressPercent ?? 0}%</span>
                    </div>
                    {isCompleted ? (
                      <span className="completed-pill">
                        <CheckCircle2 size={14} />
                        已完成
                      </span>
                    ) : isPendingReview ? (
                      <span className="review-pill">待验收</span>
                    ) : isActive ? (
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
