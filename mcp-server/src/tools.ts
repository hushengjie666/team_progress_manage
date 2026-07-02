import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { requireConfirmation, TimeManageMcpClient } from "./core.js";

const taskStatusSchema = z.enum(["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"]);
const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
const severitySchema = z.enum(["low", "medium", "high", "very_high"]);
const stageSchema = z.enum(["sales", "requirements", "design", "development", "testing", "deployment", "acceptance"]);
const repeatRuleSchema = z.enum(["none", "daily", "weekly", "interval", "weekdays", "monthly", "after_completion"]);
const projectMemberRoleSchema = z.enum(["project_owner", "executor"]);
const moodSchema = z.enum(["low", "normal", "good", "great"]);

const taskInputSchema = {
  title: z.string(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: prioritySchema.optional(),
  severity: severitySchema.optional(),
  stage: stageSchema.optional(),
  estimateHours: z.number().optional(),
  estimatePomodoros: z.number().optional(),
  primaryExecutorMemberId: z.string().optional(),
  collaboratorMemberIds: z.array(z.string()).optional(),
  expectedStartAt: z.string().optional(),
  expectedFinishAt: z.string().optional(),
  dueAt: z.string().optional(),
  reminderAt: z.string().optional(),
  repeatRule: repeatRuleSchema.optional(),
  repeatIntervalDays: z.number().optional(),
  subtasks: z.array(z.string()).optional(),
};

const jsonResult = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

const textResult = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
});

const handle = async (fn: () => Promise<unknown>): Promise<CallToolResult> => {
  try {
    return jsonResult(await fn());
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    };
  }
};

export function registerTimeManageTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description: "列出 TimeManage 项目及项目级进度、任务、成员概要。",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => handle(() => client.listProjects()),
  );

  server.registerTool(
    "search",
    {
      title: "Search TimeManage",
      description: "跨项目、成员、任务做关键词搜索，用于把自然语言名称解析为 id。",
      inputSchema: {
        query: z.string(),
        limit: z.number().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => handle(() => client.search(query, limit)),
  );

  server.registerTool(
    "create_project",
    {
      title: "Create Project",
      description: "创建项目，并把当前 MCP 登录账号作为项目负责人/执行者绑定。",
      inputSchema: {
        name: z.string(),
        description: z.string().optional(),
        defaultExpectedStartHours: z.number().optional(),
        taskStageMode: z.enum(["regular", "software"]).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.createProject(input)),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update Project",
      description: "更新项目名称、说明和默认预计开始小时。",
      inputSchema: {
        projectId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        defaultExpectedStartHours: z.number().optional(),
        taskStageMode: z.enum(["regular", "software"]).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectId, ...input }) => handle(() => client.updateProject(projectId, input)),
  );

  server.registerTool(
    "archive_project",
    {
      title: "Archive Project",
      description: "归档项目。高风险，必须确认。",
      inputSchema: {
        projectId: z.string(),
        confirmed: z.boolean().optional().describe("仅在用户明确确认归档项目后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ projectId, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "archive_project");
      return client.archiveProject(projectId);
    }),
  );

  server.registerTool(
    "restore_project",
    {
      title: "Restore Project",
      description: "恢复已归档项目。",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.restoreProject(projectId)),
  );

  server.registerTool(
    "list_members",
    {
      title: "List Members",
      description: "列出当前可见项目成员；传项目 ID 时只列出该项目成员。",
      inputSchema: {
        projectId: z.string().optional().describe("项目 ID；为空时按账号/邮箱去重列出所有可见项目成员。"),
        includeDisabled: z.boolean().optional().describe("是否包含停用成员。"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId, includeDisabled }) => handle(() => client.listMembers(projectId, includeDisabled)),
  );

  server.registerTool(
    "create_member",
    {
      title: "Create Project Member",
      description: "在指定项目中新建项目成员。",
      inputSchema: {
        projectId: z.string(),
        name: z.string(),
        email: z.string().optional().describe("登录邮箱或手机号。"),
        accountId: z.string().optional(),
        roles: z.array(projectMemberRoleSchema).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.createMember(input)),
  );

  server.registerTool(
    "update_member",
    {
      title: "Update Project Member",
      description: "更新项目成员资料或启停状态。",
      inputSchema: {
        projectMemberId: z.string(),
        name: z.string().optional(),
        email: z.string().optional().describe("登录邮箱或手机号。"),
        status: z.enum(["active", "disabled"]).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectMemberId, ...input }) => handle(() => client.updateMember(projectMemberId, input)),
  );

  server.registerTool(
    "delete_member",
    {
      title: "Delete Project Member",
      description: "解除项目成员绑定，并清理任务引用。高风险，必须确认。",
      inputSchema: {
        projectMemberId: z.string(),
        confirmed: z.boolean().optional().describe("仅在用户明确确认解除项目成员绑定后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ projectMemberId, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "delete_member");
      return client.deleteMember(projectMemberId);
    }),
  );

  server.registerTool(
    "bind_member_to_project",
    {
      title: "Bind Member To Project",
      description: "按现有项目成员 ID、账号 ID 或邮箱，把成员绑定到另一个项目并设置项目角色。",
      inputSchema: {
        projectId: z.string(),
        memberRef: z.string(),
        roles: z.array(projectMemberRoleSchema).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectId, memberRef, roles }) => handle(() => client.bindMemberToProject(projectId, memberRef, roles)),
  );

  server.registerTool(
    "update_project_member",
    {
      title: "Update Project Member",
      description: "更新项目成员角色或启停状态。",
      inputSchema: {
        projectMemberId: z.string(),
        roles: z.array(projectMemberRoleSchema).optional(),
        status: z.enum(["active", "disabled"]).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectMemberId, ...input }) => handle(() => client.updateProjectMember(projectMemberId, input)),
  );

  server.registerTool(
    "unbind_project_member",
    {
      title: "Unbind Project Member",
      description: "解除项目成员绑定，并清理该项目成员的任务引用。高风险，必须确认。",
      inputSchema: {
        projectMemberId: z.string(),
        confirmed: z.boolean().optional().describe("仅在用户明确确认解绑项目成员后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ projectMemberId, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "unbind_project_member");
      return client.unbindProjectMember(projectMemberId);
    }),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description: "按项目、状态、执行人或关键词查询任务。",
      inputSchema: {
        projectId: z.string().optional(),
        status: taskStatusSchema.or(z.literal("all")).optional(),
        assigneeMemberId: z.string().optional(),
        query: z.string().optional(),
        includeArchived: z.boolean().optional(),
        includeSplit: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => handle(() => client.listTasks(input)),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get Task",
      description: "读取单个任务详情、项目成员和关联工作会话。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.getTask(taskId)),
  );

  server.registerTool(
    "get_today_plan",
    {
      title: "Get Today Plan",
      description: "读取今天的准备执行队列及队列任务。",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => handle(() => client.getTodayPlan()),
  );

  server.registerTool(
    "get_today_workbench",
    {
      title: "Get Today Workbench",
      description: "按成员分组读取今日准备执行任务，并标记当前正在执行的任务。",
      inputSchema: { projectId: z.string().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.getTodayWorkbench(projectId)),
  );

  server.registerTool(
    "get_active_work",
    {
      title: "Get Active Work",
      description: "读取当前 active/paused 工作会话，跨用户判断谁正在执行什么。",
      inputSchema: { projectId: z.string().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.getActiveWork(projectId)),
  );

  server.registerTool(
    "get_project_overview",
    {
      title: "Get Project Overview",
      description: "读取单项目概览，包括进度、活跃会话、风险分组和状态计数。",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.getProjectOverview(projectId)),
  );

  server.registerTool(
    "list_pending_reviews",
    {
      title: "List Pending Reviews",
      description: "查询待验收任务，可按项目过滤。",
      inputSchema: { projectId: z.string().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.listPendingReviews(projectId)),
  );

  server.registerTool(
    "list_risk_tasks",
    {
      title: "List Risk Tasks",
      description: "查询项目风险任务，包括已分配未开始、停滞、阻塞、待验收和临近预计完成。",
      inputSchema: { projectId: z.string().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.listRiskTasks(projectId)),
  );

  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description: "在指定项目创建任务，默认状态为任务池 pool。",
      inputSchema: {
        projectId: z.string(),
        ...taskInputSchema,
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.createTask(input)),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description: "更新任务基本信息、分类、排期和子任务。",
      inputSchema: {
        taskId: z.string(),
        title: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        priority: prioritySchema.optional(),
        severity: severitySchema.optional(),
        stage: stageSchema.optional(),
        estimateHours: z.number().optional(),
        estimatePomodoros: z.number().optional(),
        expectedStartAt: z.string().optional(),
        expectedFinishAt: z.string().optional(),
        dueAt: z.string().optional(),
        reminderAt: z.string().optional(),
        repeatRule: repeatRuleSchema.optional(),
        repeatIntervalDays: z.number().optional(),
        subtasks: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, ...input }) => handle(() => client.updateTask(taskId, input)),
  );

  server.registerTool(
    "batch_create_tasks",
    {
      title: "Batch Create Tasks",
      description: "在同一项目批量创建任务，适合从会议纪要或需求清单拆出任务。",
      inputSchema: {
        projectId: z.string(),
        tasks: z.array(z.object(taskInputSchema)),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectId, tasks }) => handle(() => client.batchCreateTasks(projectId, tasks)),
  );

  server.registerTool(
    "batch_assign_tasks",
    {
      title: "Batch Assign Tasks",
      description: "批量分配任务主执行人和协作者。",
      inputSchema: {
        taskIds: z.array(z.string()),
        projectId: z.string().optional(),
        primaryExecutorMemberId: z.string().optional(),
        collaboratorMemberIds: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskIds, ...assignment }) => handle(() => client.batchAssignTasks(taskIds, assignment)),
  );

  server.registerTool(
    "batch_add_tasks_to_today",
    {
      title: "Batch Add Tasks To Today",
      description: "批量加入今日准备执行队列。",
      inputSchema: { taskIds: z.array(z.string()) },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskIds }) => handle(() => client.batchAddTasksToToday(taskIds)),
  );

  server.registerTool(
    "split_task",
    {
      title: "Split Task",
      description: "把一个主任务标记为已拆分，并创建多个子任务。高风险，必须确认。",
      inputSchema: {
        taskId: z.string(),
        childTitles: z.array(z.string()),
        confirmed: z.boolean().optional().describe("仅在用户确认拆分主任务后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ taskId, childTitles, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "split_task");
      return client.splitTask(taskId, childTitles);
    }),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description: "删除任务并同步清理今日队列、工作会话和执行信号引用。高风险，必须确认。",
      inputSchema: {
        taskId: z.string(),
        confirmed: z.boolean().optional().describe("仅在用户明确确认删除后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ taskId, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "delete_task");
      return client.deleteTask(taskId);
    }),
  );

  server.registerTool(
    "assign_task",
    {
      title: "Assign Task",
      description: "分配任务主执行人、协作者，必要时迁移项目。",
      inputSchema: {
        taskId: z.string(),
        projectId: z.string().optional(),
        primaryExecutorMemberId: z.string().optional(),
        collaboratorMemberIds: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, ...assignment }) => handle(() => client.assignTask(taskId, assignment)),
  );

  server.registerTool(
    "set_task_status",
    {
      title: "Set Task Status",
      description: "直接修改任务状态。归档、完成、已拆分等高风险状态必须确认。",
      inputSchema: {
        taskId: z.string(),
        status: taskStatusSchema,
        confirmed: z.boolean().optional().describe("状态为 completed/split/archived 时，必须在用户确认后传 true。"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, status, confirmed }) => handle(async () => {
      if (status === "completed" || status === "split" || status === "archived") requireConfirmation(confirmed, `set_task_status:${status}`);
      return client.setTaskStatus(taskId, status);
    }),
  );

  server.registerTool(
    "update_task_progress",
    {
      title: "Update Task Progress",
      description: "更新任务进度百分比和进展说明。",
      inputSchema: {
        taskId: z.string(),
        progressPercent: z.number().min(0).max(100),
        progressNote: z.string().optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, progressPercent, progressNote }) => handle(() => client.updateTaskProgress(taskId, progressPercent, progressNote)),
  );

  server.registerTool(
    "add_task_to_today",
    {
      title: "Add Task To Today",
      description: "把任务加入今天准备执行队列；任务为 pool 时会转为 committed。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.addTaskToToday(taskId)),
  );

  server.registerTool(
    "remove_task_from_today",
    {
      title: "Remove Task From Today",
      description: "从今天准备执行队列移除任务；任务仍为 committed 时会回到 pool。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.removeTaskFromToday(taskId)),
  );

  server.registerTool(
    "start_task",
    {
      title: "Start Task",
      description: "开始任务，创建 FocusSession、WorkSession 和 ExecutionSignal，并把任务转为 in_progress。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.startTask(taskId)),
  );

  server.registerTool(
    "pause_work_session",
    {
      title: "Pause Work Session",
      description: "暂停当前工作会话，可按 taskId 或 workSessionId 定位。",
      inputSchema: { taskId: z.string().optional(), workSessionId: z.string().optional() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.pauseWorkSession(input)),
  );

  server.registerTool(
    "resume_work_session",
    {
      title: "Resume Work Session",
      description: "恢复暂停中的工作会话，可按 taskId 或 workSessionId 定位。",
      inputSchema: { taskId: z.string().optional(), workSessionId: z.string().optional() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.resumeWorkSession(input)),
  );

  server.registerTool(
    "finish_work_session",
    {
      title: "Finish Work Session",
      description: "结束工作会话，完成一颗番茄并写入 work_ended 信号。",
      inputSchema: { taskId: z.string().optional(), workSessionId: z.string().optional() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.finishWorkSession(input)),
  );

  server.registerTool(
    "submit_task_review",
    {
      title: "Submit Task Review",
      description: "提交任务验收：committed/in_progress -> pending_review。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.submitTaskReview(taskId)),
  );

  server.registerTool(
    "accept_task_review",
    {
      title: "Accept Task Review",
      description: "验收通过：pending_review -> completed。高风险，必须确认。",
      inputSchema: {
        taskId: z.string(),
        confirmed: z.boolean().optional().describe("仅在用户明确确认验收通过后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ taskId, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "accept_task_review");
      return client.acceptTaskReview(taskId);
    }),
  );

  server.registerTool(
    "return_task_review",
    {
      title: "Return Task Review",
      description: "验收退回：pending_review -> in_progress。",
      inputSchema: {
        taskId: z.string(),
        reason: z.string().optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, reason }) => handle(() => client.returnTaskReview(taskId, reason ?? "")),
  );

  server.registerTool(
    "get_daily_summary",
    {
      title: "Get Daily Summary",
      description: "读取某日的计划、今日队列任务、工作会话和洞察。",
      inputSchema: { date: z.string().optional().describe("YYYY-MM-DD；默认今天。") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ date }) => handle(() => client.getDailySummary(date)),
  );

  server.registerTool(
    "update_daily_review",
    {
      title: "Update Daily Review",
      description: "更新某日总结/日终回顾字段。",
      inputSchema: {
        date: z.string().describe("YYYY-MM-DD"),
        mood: moodSchema.optional(),
        wins: z.string().optional(),
        blockers: z.string().optional(),
        interruptionPattern: z.string().optional(),
        tomorrowFocus: z.string().optional(),
        reflection: z.string().optional(),
        reviewed: z.boolean().optional().describe("true 表示标记已回顾，false 表示取消已回顾。"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ date, ...patch }) => handle(() => client.updateDailyReview(date, patch)),
  );

  server.registerTool(
    "get_sync_diagnostics",
    {
      title: "Get Sync Diagnostics",
      description: "读取 MCP 视角下的后台诊断，包括本地 revision、远端 revision、实体数量和冲突数。",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => handle(() => client.getSyncDiagnostics()),
  );

  server.registerTool(
    "health",
    {
      title: "Health",
      description: "检查 MCP server 本身是否可用。",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => textResult("TimeManage MCP server is running."),
  );
}
