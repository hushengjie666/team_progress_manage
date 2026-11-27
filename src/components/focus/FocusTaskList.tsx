import { useCompletionFeedback } from "../completion/CompletionFeedback";
import type { CompleteTask } from "../../appTaskActionsTypes";
import { useEffect, useState, type MouseEvent } from "react";
import { Check, CircleCheck, Clock3, Play, Plus, Timer } from "lucide-react";
import { projectToneClassName } from "../../projectVisuals";
import type { SessionMode, Task } from "../../types";
import type { FocusTaskGroup } from "./focusModel";

export function FocusTaskList(props: {
  groups: FocusTaskGroup[];
  completionLabel: (task: Task) => string | undefined;
  completeTask: CompleteTask;
  pendingResourceKeys?: string[];
  taskCount: number;
  activeTaskId?: string;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  openCreateTask: () => void;
  canCreateTask: boolean;
  saving: boolean;
}) {
  const completedCount = props.groups.reduce((count, group) =>
    count + group.tasks.filter((task) => task.status === "completed").length, 0);
  return (
    <section className="band focus-todo-panel">
      <div className="section-title">
        <div>
          <h2>今日任务</h2>
          {props.taskCount > 0 && (
            <span className="focus-todo-summary">共 {props.taskCount} 项 · 已完成 {completedCount} 项</span>
          )}
        </div>
        <span className="focus-save-status" role="status">{props.saving && "今日工作 · 保存中…"}</span>
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
  completeTask: CompleteTask;
  start: () => void;
}) {
  const prepareFeedback = useCompletionFeedback();
  const [showFeedback, setShowFeedback] = useState(false);
  useEffect(() => {
    if (!showFeedback) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const clearIfReduced = () => { if (motion.matches) setShowFeedback(false); };
    clearIfReduced();
    motion.addEventListener("change", clearIfReduced);
    return () => motion.removeEventListener("change", clearIfReduced);
  }, [showFeedback]);

  const submit = async (event: MouseEvent<HTMLButtonElement>) => {
    const status = await completeTask(task.id, prepareFeedback(task.id, event));
    if (status === "completed" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShowFeedback(true);
    }
  };

  return (
    <article className={active ? "focus-todo-item active" : "focus-todo-item"} data-status={task.status}>
      <strong>{task.title}</strong>
      <span className="focus-todo-meta">{task.actualPomodoros}/{task.estimatePomodoros} 番茄 · {task.progressPercent ?? 0}%</span>
      <div className="focus-todo-actions" aria-live="polite" onKeyDown={(event) => {
        if (event.key === " ") event.stopPropagation();
      }}>
        {task.status === "completed" ? (
          <span className={showFeedback ? "completed-pill just-completed" : "completed-pill"} onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setShowFeedback(false);
          }}>
            <CircleCheck size={14} aria-hidden="true" />已完成
          </span>
        ) : task.status === "pending_review" ? (
          <span className="review-pill"><Clock3 size={14} aria-hidden="true" />待验收</span>
        ) : (
          <>
            {active ? <span className="running-pill"><Timer size={14} aria-hidden="true" />执行中</span> : (
              <button className="small-button focus-start" disabled={pending} onClick={start}><Play size={14} aria-hidden="true" />开始</button>
            )}
            {completionLabel && (
              <button className="small-button" disabled={pending} onClick={submit}>
                <Check size={14} aria-hidden="true" />{completionLabel}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
