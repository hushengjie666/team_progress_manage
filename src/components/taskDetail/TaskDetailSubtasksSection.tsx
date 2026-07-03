import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { nowIso } from "../../appModel";
import { uid } from "../../seed";
import type { Subtask, Task } from "../../types";

type TaskDetailSubtasksSectionProps = {
  task: Task;
  canEdit: boolean;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
};

export function TaskDetailSubtasksSection({ task, canEdit, updateTask }: TaskDetailSubtasksSectionProps) {
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const addSubtask = () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    updateTask(task.id, (current) => ({
      ...current,
      subtasks: [
        ...(current.subtasks ?? []),
        { id: uid("subtask"), title, completed: false, createdAt: nowIso() },
      ],
    }));
    setSubtaskTitle("");
  };

  const updateSubtask = (subtaskId: string, patch: Partial<Subtask>) => {
    updateTask(task.id, (current) => ({
      ...current,
      subtasks: (current.subtasks ?? []).map((subtask) =>
        subtask.id === subtaskId
          ? {
              ...subtask,
              ...patch,
              completedAt: patch.completed ? nowIso() : patch.completed === false ? undefined : subtask.completedAt,
            }
          : subtask,
      ),
    }));
  };

  return (
    <div className="subtask-box">
      <div className="section-title compact-title">
        <div>
          <p className="eyebrow">子任务</p>
          <h2>子任务</h2>
        </div>
      </div>
      <div className="subtask-add">
        <input
          value={subtaskTitle}
          disabled={!canEdit}
          onChange={(event) => setSubtaskTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addSubtask();
          }}
          placeholder="添加子任务"
        />
        <button className="secondary-button" disabled={!canEdit} onClick={addSubtask}>
          <Plus size={16} />
          添加
        </button>
      </div>
      <div className="subtask-list">
        {task.subtasks.map((subtask) => (
          <label className="subtask-row" key={subtask.id}>
            <input
              type="checkbox"
              checked={subtask.completed}
              disabled={!canEdit}
              onChange={(event) => updateSubtask(subtask.id, { completed: event.target.checked })}
            />
            <span className={subtask.completed ? "done" : ""}>{subtask.title}</span>
            <button
              type="button"
              className="icon-button small"
              title="删除子任务"
              disabled={!canEdit}
              onClick={() =>
                updateTask(task.id, (current) => ({
                  ...current,
                  subtasks: current.subtasks.filter((item) => item.id !== subtask.id),
                }))
              }
            >
              <Trash2 size={15} />
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}
