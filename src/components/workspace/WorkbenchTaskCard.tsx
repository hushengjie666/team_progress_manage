import type React from "react";
import type { ActiveTimer, Task } from "../../types";
import { WorkbenchTaskActions } from "./WorkbenchTaskActions";
import { WorkbenchTaskProgressPanel } from "./WorkbenchTaskProgressPanel";
import { WorkbenchTaskSummary } from "./WorkbenchTaskSummary";

export function WorkbenchTaskCard({
  task,
  actionLabel,
  actionIcon,
  activeTimer,
  canDragSort,
  dragging,
  dragOver,
  onAction,
  onDelete,
  onRemove,
  onComplete,
  onSelect,
  onSplit,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  task: Task;
  actionLabel: string;
  actionIcon: React.ReactNode;
  activeTimer?: ActiveTimer;
  canDragSort: boolean;
  dragging: boolean;
  dragOver: boolean;
  onAction: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
  onSplit?: (taskId: string) => void;
  onDragStart: React.DragEventHandler<HTMLElement>;
  onDragEnter: React.DragEventHandler<HTMLElement>;
  onDragOver: React.DragEventHandler<HTMLElement>;
  onDrop: React.DragEventHandler<HTMLElement>;
  onDragEnd: React.DragEventHandler<HTMLElement>;
}) {
  const isTimerTask = activeTimer?.taskId === task.id;
  const isRunningTask = isTimerTask && activeTimer?.mode === "focus" && activeTimer.isRunning;
  const isPausedTask = isTimerTask && activeTimer?.mode === "focus" && !activeTimer.isRunning;
  const hasTimerState = isRunningTask || isPausedTask;
  const isCompletedTask = task.status === "completed";
  const canSubmitReview = task.status === "committed" || task.status === "in_progress";

  return (
    <article
      className={[
        "task-item",
        canDragSort ? "sortable-task" : "",
        dragging ? "dragging-task" : "",
        dragOver ? "drag-over-task" : "",
        task.estimatePomodoros > 7 ? "warning-edge" : "",
        isRunningTask ? "active-edge running-task" : "",
      ].filter(Boolean).join(" ")}
      draggable={canDragSort}
      key={task.id}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <WorkbenchTaskSummary task={task} isPausedTask={isPausedTask} />
      <div className="task-card-side">
        <WorkbenchTaskProgressPanel task={task} />
        <WorkbenchTaskActions
          task={task}
          actionLabel={actionLabel}
          actionIcon={actionIcon}
          isCompletedTask={isCompletedTask}
          hasTimerState={hasTimerState}
          isPausedTask={isPausedTask}
          canSubmitReview={canSubmitReview}
          onAction={onAction}
          onDelete={onDelete}
          onRemove={onRemove}
          onComplete={onComplete}
          onSelect={onSelect}
          onSplit={onSplit}
        />
      </div>
    </article>
  );
}
