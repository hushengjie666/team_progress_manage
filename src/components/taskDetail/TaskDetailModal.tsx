import { useEffect } from "react";
import { TaskDetailPanel } from "../TaskDetailPanel";
import type { TaskDetailPanelProps } from "./taskDetailPanelTypes";

export function TaskDetailModal(props: TaskDetailPanelProps) {
  useEffect(() => {
    if (!props.task) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  if (!props.task) return null;

  return (
    <div
      className="modal-backdrop task-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.close();
      }}
    >
      <section className="modal-panel task-detail-modal" role="dialog" aria-modal="true" aria-label={`任务详情：${props.task.title}`}>
        <TaskDetailPanel {...props} />
      </section>
    </div>
  );
}
