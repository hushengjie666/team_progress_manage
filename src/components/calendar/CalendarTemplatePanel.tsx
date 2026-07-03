import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { uid } from "../../seed";
import type { TaskTemplate } from "../../types";
import { CalendarTemplateEditor } from "./CalendarTemplateEditor";

type CalendarTemplatePanelProps = {
  templates: TaskTemplate[];
  instantiateTaskTemplate: (template: TaskTemplate) => void;
  saveTaskTemplate: (template: TaskTemplate) => void;
  deleteTaskTemplate: (templateId: string) => void;
};

export function CalendarTemplatePanel({
  templates,
  instantiateTaskTemplate,
  saveTaskTemplate,
  deleteTaskTemplate,
}: CalendarTemplatePanelProps) {
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

  return (
    <section className="band template-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">任务模板</p>
          <h2>可复用任务模板</h2>
        </div>
        <ClipboardList size={20} />
      </div>
      <CalendarTemplateEditor
        template={editingTemplate}
        onChange={setEditingTemplate}
        onNew={() =>
          setEditingTemplate({
            id: uid("template"),
            name: "自定义模板",
            description: "",
            project: "Inbox",
            tags: [],
            priority: "medium",
            severity: "medium",
            stage: "requirements",
            estimatePomodoros: 1,
            subtasks: [],
          })
        }
        onSave={() => {
          if (!editingTemplate) return;
          saveTaskTemplate(editingTemplate);
          setEditingTemplate(null);
        }}
        onCancel={() => setEditingTemplate(null)}
      />
      <div className="template-list">
        {templates.map((template) => (
          <article className="template-item" key={template.id}>
            <div>
              <strong>{template.name}</strong>
              <span>{template.description}</span>
              <small>{template.project} · {template.estimatePomodoros} 番茄 · {template.subtasks.length} 子任务</small>
            </div>
            <button className="small-button" onClick={() => instantiateTaskTemplate(template)}>
              <Plus size={15} />
              生成
            </button>
            <button className="small-button" onClick={() => setEditingTemplate(template)}>
              编辑
            </button>
            <button className="small-button" onClick={() => deleteTaskTemplate(template.id)}>
              删除
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
