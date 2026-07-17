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
  "getState" | "runTeamCommand" | "setToast" | "setSelectedTaskId" | "setTab"
>;

export function createAppTaskTemplateRuntime({
  getState,
  runTeamCommand,
  setToast,
  setSelectedTaskId,
  setTab,
}: AppTaskTemplateRuntimeOptions): AppTaskTemplateRuntime {
  const instantiateTaskTemplate = (template: TaskTemplate) => {
    const timestamp = nowIso();
    const task = instantiateTemplate(template, timestamp);
    const workspaceId = getState().auth.workspace?.id;
    void runTeamCommand({
      kind: "action",
      resource: "task-templates",
      id: template.id,
      action: "instantiate",
      workspaceId,
      payload: { task: task as unknown as Record<string, unknown> },
      idempotencyKey: `template-${template.id}-${task.id}`,
    })
      .then((saved) => {
        if (!saved) return;
        setSelectedTaskId(task.id);
        setTab("workspace");
        setToast(`已从模板生成「${task.title}」`);
      });
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
    const source = getState();
    const exists = source.taskTemplates.some((item) => item.id === normalized.id);
    void runTeamCommand(exists
      ? { kind: "patch", entity: "task_template", id: normalized.id, workspaceId: source.auth.workspace?.id, patch: normalized as unknown as Record<string, unknown> }
      : { kind: "create", entity: "task_template", workspaceId: source.auth.workspace?.id, payload: normalized as unknown as Record<string, unknown> })
      .then((saved) => saved && setToast("任务模板已保存"));
  };

  const deleteTaskTemplate = (templateId: string) => {
    void runTeamCommand({ kind: "delete", entity: "task_template", id: templateId, workspaceId: getState().auth.workspace?.id })
      .then((saved) => saved && setToast("任务模板已删除"));
  };

  return {
    instantiateTaskTemplate,
    saveTaskTemplate,
    deleteTaskTemplate,
  };
}
