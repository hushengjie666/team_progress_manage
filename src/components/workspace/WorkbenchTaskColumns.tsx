import type React from "react";
import { useState } from "react";
import type { ActiveTimer, Task } from "../../types";
import { WorkbenchTaskCard } from "./WorkbenchTaskCard";

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

  const clearDragState = () => {
    setDraggingTaskId(null);
    setDragOverTaskId(null);
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
        {props.tasks.map((task, index) => (
          <WorkbenchTaskCard
            key={task.id}
            task={task}
            actionLabel={props.actionLabel}
            actionIcon={props.actionIcon}
            activeTimer={props.activeTimer}
            canDragSort={canDragSort}
            dragging={draggingTaskId === task.id}
            dragOver={dragOverTaskId === task.id && draggingTaskId !== task.id}
            onAction={props.onAction}
            onDelete={props.onDelete}
            onRemove={props.onRemove}
            onComplete={props.onComplete}
            onSelect={props.onSelect}
            onSplit={props.onSplit}
            onMove={props.onMove}
            canMoveUp={index > 0}
            canMoveDown={index < props.tasks.length - 1}
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
              clearDragState();
            }}
            onDragEnd={clearDragState}
          />
        ))}
      </div>
    </section>
  );
}
