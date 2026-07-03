import { instantiateTemplate } from "./planning";
import { nowIso } from "./appModel";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";
import type { TaskTemplate } from "./types";

type AppTaskTemplateRuntime = Pick<
  AppTaskActionsRuntime,
  "instantiateTaskTemplate" | "saveTaskTemplate" | "deleteTaskTemplate"
>;

type AppTaskTemplateRuntimeOptions = Pick<
  AppTaskActionsRuntimeOptions,
  "updateState" | "setToast" | "setSelectedTaskId" | "setTab"
>;

export function createAppTaskTemplateRuntime({
  updateState,
  setToast,
  setSelectedTaskId,
  setTab,
}: AppTaskTemplateRuntimeOptions): AppTaskTemplateRuntime {
  const instantiateTaskTemplate = (template: TaskTemplate) => {
    const timestamp = nowIso();
    const task = instantiateTemplate(template, timestamp);
    updateState((value) => ({
      ...value,
      tasks: [task, ...value.tasks],
      templateInstances: [{ templateId: template.id, taskId: task.id, createdAt: timestamp }, ...value.templateInstances],
      updatedAt: timestamp,
    }));
    setSelectedTaskId(task.id);
    setTab("workspace");
    setToast(`已从模板生成「${task.title}」`);
  };

  const saveTaskTemplate = (template: TaskTemplate) => {
    const normalized: TaskTemplate = {
      ...template,
      name: template.name.trim() || "未命名模板",
      project: template.project.trim() || "Inbox",
      tags: template.tags.map((tag) => tag.trim()).filter(Boolean),
      stage: template.stage ?? "requirements",
      estimatePomodoros: Math.max(1, Math.round(template.estimatePomodoros)),
      subtasks: template.subtasks.map((item) => item.trim()).filter(Boolean),
    };
    updateState((value) => ({
      ...value,
      taskTemplates: value.taskTemplates.some((item) => item.id === normalized.id)
        ? value.taskTemplates.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...value.taskTemplates],
      updatedAt: nowIso(),
    }));
    setToast("任务模板已保存");
  };

  const deleteTaskTemplate = (templateId: string) => {
    updateState((value) => ({
      ...value,
      taskTemplates: value.taskTemplates.filter((item) => item.id !== templateId),
      updatedAt: nowIso(),
    }));
    setToast("任务模板已删除");
  };

  return {
    instantiateTaskTemplate,
    saveTaskTemplate,
    deleteTaskTemplate,
  };
}
