import type React from "react";
import { useState } from "react";
import { Activity, Check, PanelRight, Split, Trash2, X } from "lucide-react";
import { labelPriority, labelTaskStage } from "../../appModel";
import type { ActiveTimer, Task } from "../../types";

export function TaskColumn(props: {
  title: string;
  eyebrow: string;
  titleAccessory?: React.ReactNode;
  tasks: Task[];
  empty: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
  onSplit?: (taskId: string) => void;
  onMove?: (taskId: string, direction: -1 | 1) => void;
  activeTimer?: ActiveTimer;
}) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const canDragSort = Boolean(props.onMove);

  const moveTaskTo = (taskId: string, targetTaskId: string) => {
    if (!props.onMove || taskId === targetTaskId) return;
    const fromIndex = props.tasks.findIndex((task) => task.id === taskId);
    const toIndex = props.tasks.findIndex((task) => task.id === targetTaskId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const direction: -1 | 1 = fromIndex < toIndex ? 1 : -1;
    for (let index = fromIndex; index !== toIndex; index += direction) {
      props.onMove(taskId, direction);
    }
  };

  return (
    <section className="band task-column">
      <div className="section-title">
        <div>
          <p className="eyebrow">{props.eyebrow}</p>
          <div className="task-column-title-row">
            <h2>{props.title}</h2>
            {props.titleAccessory}
          </div>
        </div>
        <span className="count-pill">{props.tasks.length}</span>
      </div>
      <div className="task-list">
        {props.tasks.length === 0 && <p className="empty">{props.empty}</p>}
        {props.tasks.map((task) => {
          const isTimerTask = props.activeTimer?.taskId === task.id;
          const isRunningTask = isTimerTask && props.activeTimer?.mode === "focus" && props.activeTimer.isRunning;
          const isPausedTask = isTimerTask && props.activeTimer?.mode === "focus" && !props.activeTimer.isRunning;
          const hasTimerState = isRunningTask || isPausedTask;
          const isCompletedTask = task.status === "completed";
          const canSubmitReview = task.status === "committed" || task.status === "in_progress";
          const visibleTags = task.tags.filter((tag) => tag !== task.project && tag !== labelTaskStage[task.stage]);
          const visibleNotes = task.notes.startsWith("由「") && task.notes.endsWith("」拆分而来。") ? "" : task.notes;
          return (
            <article
              className={[
                "task-item",
                canDragSort ? "sortable-task" : "",
                draggingTaskId === task.id ? "dragging-task" : "",
                dragOverTaskId === task.id && draggingTaskId !== task.id ? "drag-over-task" : "",
                task.estimatePomodoros > 7 ? "warning-edge" : "",
                isRunningTask ? "active-edge running-task" : "",
              ].filter(Boolean).join(" ")}
              draggable={canDragSort}
              key={task.id}
              onDragStart={(event) => {
                if (!canDragSort) return;
                setDraggingTaskId(task.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", task.id);
              }}
              onDragEnter={(event) => {
                if (!canDragSort || !draggingTaskId || draggingTaskId === task.id) return;
                event.preventDefault();
                setDragOverTaskId(task.id);
              }}
              onDragOver={(event) => {
                if (!canDragSort || !draggingTaskId || draggingTaskId === task.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverTaskId(task.id);
              }}
              onDrop={(event) => {
                if (!canDragSort) return;
                event.preventDefault();
                const sourceTaskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
                if (sourceTaskId) moveTaskTo(sourceTaskId, task.id);
                setDraggingTaskId(null);
                setDragOverTaskId(null);
              }}
              onDragEnd={() => {
                setDraggingTaskId(null);
                setDragOverTaskId(null);
              }}
            >
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
                {visibleNotes && <div className="task-summary-line">
                  <p>{visibleNotes}</p>
                </div>}
              </div>
              <div className="task-card-side">
                <div className="task-progress-panel">
                  <div className="task-progress-heading">
                    <span className={`priority priority-${task.priority}`}>{labelPriority[task.priority]}</span>
                    <span className="task-progress-numbers">
                      <strong>{task.progressPercent ?? 0}%</strong>
                      <span>{task.actualPomodoros}/{task.estimatePomodoros} 番茄</span>
                    </span>
                  </div>
                  <TaskProgressBar percent={task.progressPercent ?? 0} compact showValue={false} />
                </div>
                <div className="task-actions">
                  <div className="task-secondary-actions">
                    {props.onSelect && (
                      <button className="icon-button small" title="任务详情" onClick={() => props.onSelect?.(task.id)}>
                        <PanelRight size={16} />
                      </button>
                    )}
                    {props.onSplit && task.status !== "completed" && task.status !== "split" && task.status !== "archived" && (
                      <button className="icon-button small" title="拆分任务" onClick={() => props.onSplit?.(task.id)}>
                        <Split size={16} />
                      </button>
                    )}
                    {props.onComplete && canSubmitReview && (
                      <button className="icon-button small" title="提交验收" onClick={() => props.onComplete?.(task.id)}>
                        <Check size={16} />
                      </button>
                    )}
                    {props.onRemove && (
                      <button className="icon-button small" title="移回活动清单" onClick={() => props.onRemove?.(task.id)}>
                        <X size={16} />
                      </button>
                    )}
                    {props.onDelete && (
                      <button className="icon-button small danger" title="删除任务" onClick={() => props.onDelete?.(task.id)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="task-primary-actions">
                    {isCompletedTask ? (
                      <span className="small-button active-action completed-action" aria-label="今日已完成的任务">
                        <Check size={15} />
                        已完成
                      </span>
                    ) : hasTimerState ? (
                      <span className="small-button active-action" aria-label="当前正在执行的任务">
                        <Activity className="active-action-icon" size={15} />
                        {isPausedTask ? "已暂停" : "执行中"}
                      </span>
                    ) : (
                      <button className="small-button task-primary-action" onClick={() => props.onAction(task.id)}>
                        {props.actionIcon}
                        {props.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TaskProgressBar({ percent, compact = false, showValue = true }: { percent: number; compact?: boolean; showValue?: boolean }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="task-progress-bar" aria-label={`任务进度 ${safe}%`}>
      <span style={{ width: `${safe}%` }} />
      {showValue && !compact && <strong>{safe}%</strong>}
      {showValue && compact && <em>{safe}%</em>}
    </div>
  );
}
