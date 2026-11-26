import { useState } from "react";
import { Check, CheckCircle2, Play, Plus } from "lucide-react";
import { projectToneClassName } from "../../projectVisuals";
import type { SessionMode, Task } from "../../types";
import type { FocusTaskGroup } from "./focusModel";

export function FocusTaskList(props: {
  groups: FocusTaskGroup[];
  completionLabel: (task: Task) => string | undefined;
  completeTask: (taskId: string) => Promise<Task["status"] | undefined>;
  pendingResourceKeys?: string[];
  taskCount: number;
  activeTaskId?: string;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  openCreateTask: () => void;
  canCreateTask: boolean;
  saving: boolean;
}) {
  return (
    <section className="band focus-todo-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow" aria-live="polite">{props.saving ? "今日工作 · 保存中…" : "今日工作"}</p>
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
              {group.tasks.map((task) => (
                <FocusTaskCard
                  key={task.id}
                  task={task}
                  active={task.id === props.activeTaskId}
                  pending={props.pendingResourceKeys?.includes(`task:${task.id}`) ?? false}
                  completionLabel={props.completionLabel(task)}
                  completeTask={props.completeTask}
                  start={() => void props.beginTimer("focus", task.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function FocusTaskCard({ task, active, pending, completionLabel, completeTask, start }: {
  task: Task;
  active: boolean;
  pending: boolean;
  completionLabel?: string;
  completeTask: (taskId: string) => Promise<Task["status"] | undefined>;
  start: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const submit = async () => {
    const status = await completeTask(task.id);
    if (status === "completed" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShowFeedback(true);
    }
  };

  return (
    <article className={active ? "focus-todo-item active" : "focus-todo-item"}>
      <div>
        <strong>{task.title}</strong>
        <span>{task.actualPomodoros}/{task.estimatePomodoros} 番茄 · {task.progressPercent ?? 0}%</span>
      </div>
      <div className="focus-todo-actions" aria-live="polite" onKeyDown={(event) => {
        if (event.key === " ") event.stopPropagation();
      }}>
        {task.status === "completed" ? (
          <span className={showFeedback ? "completed-pill just-completed" : "completed-pill"} onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setShowFeedback(false);
          }}>
            <CheckCircle2 size={14} aria-hidden="true" />已完成
          </span>
        ) : task.status === "pending_review" ? (
          <span className="review-pill">待验收</span>
        ) : (
          <>
            {active ? <span className="running-pill">执行中</span> : (
              <button className="small-button" disabled={pending} onClick={start}><Play size={14} />开始</button>
            )}
            {completionLabel && (
              <button className="small-button" disabled={pending} onClick={() => void submit()}>
                <Check size={14} />{completionLabel}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
