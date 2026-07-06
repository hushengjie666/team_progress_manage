import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TimeManageMcpClient } from "../core.js";
import {
  interruptionActionSchema,
  interruptionTypeSchema,
  prioritySchema,
  repeatRuleSchema,
  sessionOutcomeSchema,
  settingsInputShape,
  severitySchema,
  taskStageSchema,
} from "../schemas.js";
import { confirmedShape, registerJsonTool, workSessionShape } from "./helpers.js";

export const registerTodayAndWorkTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(server, "get_today_plan", "读取当前账号今日或指定日期的计划。", { date: z.string().optional() }, ({ date }) => client.getTodayPlan(date), true);
  registerJsonTool(
    server,
    "get_today_workbench",
    "按成员读取今日或指定日期的工作台。",
    { projectId: z.string().optional(), date: z.string().optional() },
    ({ projectId, date }) => client.getTodayWorkbench(projectId, date),
    true,
  );
  registerJsonTool(server, "add_task_to_today", "把任务加入当前账号今日工作队列。", { taskId: z.string() }, ({ taskId }) => client.addTaskToToday(taskId));
  registerJsonTool(server, "batch_add_tasks_to_today", "批量加入当前账号今日工作队列。", { taskIds: z.array(z.string()) }, ({ taskIds }) => client.batchAddTasksToToday(taskIds));
  registerJsonTool(server, "remove_task_from_today", "把任务从当前账号今日工作队列移出。", { taskId: z.string() }, ({ taskId }) => client.removeTaskFromToday(taskId));
  registerJsonTool(server, "move_today_task", "调整今日工作队列顺序。", { taskId: z.string(), direction: z.union([z.literal(-1), z.literal(1)]) }, ({ taskId, direction }) => client.moveTodayTask(taskId, direction));
  registerJsonTool(server, "schedule_task_for_date", "把任务排入指定日期计划，不改变任务所属工作区。", { taskId: z.string(), date: z.string() }, ({ taskId, date }) => client.scheduleTaskForDate(taskId, date));
  registerJsonTool(server, "start_task", "开始执行任务并创建工作会话。", { taskId: z.string() }, ({ taskId }) => client.startTask(taskId));
  registerJsonTool(server, "pause_work_session", "暂停工作会话。", workSessionShape, (input) => client.pauseWorkSession(input));
  registerJsonTool(server, "resume_work_session", "继续工作会话。", workSessionShape, (input) => client.resumeWorkSession(input));
  registerJsonTool(server, "finish_work_session", "结束工作会话。", { ...workSessionShape, outcome: sessionOutcomeSchema.optional() }, (input) => client.finishWorkSession(input));
  registerJsonTool(server, "get_active_work", "读取当前活跃或暂停的工作会话。", { projectId: z.string().optional() }, ({ projectId }) => client.getActiveWork(projectId), true);
  registerJsonTool(
    server,
    "record_interruption",
    "记录一次工作打断。",
    { taskId: z.string().optional(), workSessionId: z.string().optional(), type: interruptionTypeSchema, note: z.string().optional(), action: interruptionActionSchema.optional() },
    (input) => client.recordInterruption(input),
  );
};

export const registerReviewAndSettingsTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(server, "submit_task_review", "提交任务验收。", { taskId: z.string() }, ({ taskId }) => client.submitTaskReview(taskId));
  registerJsonTool(server, "accept_task_review", "通过任务验收。需要 confirmed=true。", { taskId: z.string(), ...confirmedShape }, ({ taskId, confirmed }) => client.acceptTaskReview(taskId, confirmed));
  registerJsonTool(server, "return_task_review", "退回任务验收。", { taskId: z.string(), reason: z.string() }, ({ taskId, reason }) => client.returnTaskReview(taskId, reason));
  registerJsonTool(server, "get_daily_summary", "读取日计划、工作会话和打断摘要。", { date: z.string().optional() }, ({ date }) => client.getDailySummary(date), true);
  registerJsonTool(
    server,
    "update_daily_review",
    "更新日复盘和容量。",
    {
      date: z.string().optional(),
      workspaceId: z.string().optional(),
      reflection: z.string().optional(),
      capacityPomodoros: z.number().optional(),
      mood: z.enum(["low", "normal", "good", "great"]).optional(),
      wins: z.string().optional(),
      blockers: z.string().optional(),
      interruptionPattern: z.string().optional(),
      tomorrowFocus: z.string().optional(),
    },
    (input) => client.updateDailyReview(input),
  );
  registerJsonTool(server, "get_settings", "读取个人设置。", {}, () => client.getSettings(), true);
  registerJsonTool(server, "update_settings", "更新个人设置。", settingsInputShape, (input) => client.updateSettings(input));
  registerJsonTool(server, "list_task_templates", "列出任务模板。", {}, () => client.listTaskTemplates(), true);
  registerJsonTool(
    server,
    "save_task_template",
    "新增或更新任务模板。",
    {
      id: z.string().optional(),
      name: z.string(),
      description: z.string().optional(),
      project: z.string().optional(),
      tags: z.array(z.string()).optional(),
      priority: prioritySchema.optional(),
      severity: severitySchema.optional(),
      stage: taskStageSchema.optional(),
      estimatePomodoros: z.number().optional(),
      subtasks: z.array(z.string()).optional(),
      repeatRule: repeatRuleSchema.optional(),
    },
    (input) => client.saveTaskTemplate({
      id: input.id,
      name: input.name,
      description: input.description ?? "",
      project: input.project ?? "",
      tags: input.tags ?? [],
      priority: input.priority ?? "medium",
      severity: input.severity ?? "medium",
      stage: input.stage,
      estimatePomodoros: input.estimatePomodoros ?? 1,
      subtasks: input.subtasks ?? [],
      repeatRule: input.repeatRule,
    }),
  );
  registerJsonTool(server, "delete_task_template", "删除任务模板。需要 confirmed=true。", { templateId: z.string(), ...confirmedShape }, ({ templateId, confirmed }) => client.deleteTaskTemplate(templateId, confirmed));
  registerJsonTool(server, "instantiate_task_template", "按模板创建项目任务。", { templateId: z.string(), projectId: z.string() }, ({ templateId, projectId }) => client.instantiateTaskTemplate(templateId, projectId));
};
