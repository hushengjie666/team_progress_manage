import { Plus } from "lucide-react";
import { taskStageOptions } from "../../appModel";
import type { Priority, Severity, TaskStage, TaskTemplate } from "../../types";

type CalendarTemplateEditorProps = {
  template: TaskTemplate | null;
  onChange: (template: TaskTemplate | null) => void;
  onNew: () => void;
  onSave: () => void;
  onCancel: () => void;
};

export function CalendarTemplateEditor(props: CalendarTemplateEditorProps) {
  if (!props.template) {
    return (
      <button className="secondary-button" onClick={props.onNew}>
        <Plus size={15} />
        新建模板
      </button>
    );
  }
  const template = props.template;
  const update = (patch: Partial<TaskTemplate>) => props.onChange({ ...template, ...patch });
  return (
    <div className="template-editor">
      <label>
        名称
        <input value={template.name} onChange={(event) => update({ name: event.target.value })} />
      </label>
      <label>
        项目
        <input value={template.project} onChange={(event) => update({ project: event.target.value })} />
      </label>
      <label>
        标签
        <input value={template.tags.join(", ")} onChange={(event) => update({ tags: event.target.value.split(/[,\s，]+/).filter(Boolean) })} />
      </label>
      <label>
        番茄
        <input type="number" min="1" max="12" value={template.estimatePomodoros} onChange={(event) => update({ estimatePomodoros: Number(event.target.value) })} />
      </label>
      <label>
        优先级
        <select value={template.priority} onChange={(event) => update({ priority: event.target.value as Priority })}>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </select>
      </label>
      <label>
        严重度
        <select value={template.severity} onChange={(event) => update({ severity: event.target.value as Severity })}>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="very_high">非常高</option>
        </select>
      </label>
      <label>
        阶段
        <select value={template.stage ?? "requirements"} onChange={(event) => update({ stage: event.target.value as TaskStage })}>
          {taskStageOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="span-2">
        说明
        <textarea value={template.description} onChange={(event) => update({ description: event.target.value })} />
      </label>
      <label className="span-2">
        子任务
        <textarea value={template.subtasks.join("\n")} onChange={(event) => update({ subtasks: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) })} />
      </label>
      <div className="button-row span-2">
        <button className="primary-button" onClick={props.onSave}>保存模板</button>
        <button className="secondary-button" onClick={props.onCancel}>取消</button>
      </div>
    </div>
  );
}
