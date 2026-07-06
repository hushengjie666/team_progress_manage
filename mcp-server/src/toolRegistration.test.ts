import { describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TimeManageMcpClient as TimeManageMcpClientType } from "./core.js";
import { registerTimeManageTools } from "./tools.js";

type RegisteredTool = {
  config: {
    description?: string;
    inputSchema?: Record<string, unknown>;
    annotations?: { readOnlyHint?: boolean; openWorldHint?: boolean };
  };
  callback: (input: Record<string, unknown>) => Promise<CallToolResult>;
};

const expectedTools = [
  "health",
  "get_backend_diagnostics",
  "get_current_account",
  "list_workspaces",
  "switch_workspace",
  "create_workspace",
  "update_workspace",
  "update_workspace_membership",
  "list_platform_accounts",
  "create_platform_account",
  "update_platform_account",
  "disable_platform_account",
  "update_platform_account_password",
  "list_workspace_invitations",
  "invite_workspace_member",
  "accept_workspace_invitation",
  "delete_workspace_invitation",
  "list_project_invitations",
  "invite_project_member",
  "accept_project_invitation",
  "delete_project_invitation",
  "list_members",
  "create_member",
  "update_member",
  "delete_member",
  "bind_member_to_project",
  "unbind_project_member",
  "create_member_account",
  "update_member_account",
  "list_projects",
  "search",
  "get_project_overview",
  "create_project",
  "update_project",
  "archive_project",
  "restore_project",
  "get_member_status",
  "list_pending_reviews",
  "list_risk_tasks",
  "list_tasks",
  "get_task",
  "create_task",
  "batch_create_tasks",
  "update_task",
  "delete_task",
  "assign_task",
  "batch_assign_tasks",
  "set_task_status",
  "update_task_progress",
  "split_task",
  "get_today_plan",
  "get_today_workbench",
  "add_task_to_today",
  "batch_add_tasks_to_today",
  "remove_task_from_today",
  "move_today_task",
  "schedule_task_for_date",
  "start_task",
  "pause_work_session",
  "resume_work_session",
  "finish_work_session",
  "get_active_work",
  "record_interruption",
  "submit_task_review",
  "accept_task_review",
  "return_task_review",
  "get_daily_summary",
  "update_daily_review",
  "get_settings",
  "update_settings",
  "list_task_templates",
  "save_task_template",
  "delete_task_template",
  "instantiate_task_template",
];

const sampleInputs: Record<string, Record<string, unknown>> = {
  switch_workspace: { workspaceId: "workspace_1" },
  create_workspace: { name: "新工作区" },
  update_workspace: { workspaceId: "workspace_1", name: "工作区", type: "shared" },
  update_workspace_membership: { workspaceId: "workspace_1", membershipId: "membership_1", role: "admin", status: "active" },
  create_platform_account: { name: "成员", email: "member@example.com", password: "1234" },
  update_platform_account: { accountId: "account_1", name: "成员" },
  disable_platform_account: { accountId: "account_1", confirmed: true },
  update_platform_account_password: { accountId: "account_1", password: "5678" },
  invite_workspace_member: { workspaceId: "workspace_1", email: "member@example.com" },
  accept_workspace_invitation: { invitationId: "invitation_1" },
  delete_workspace_invitation: { invitationId: "invitation_1" },
  invite_project_member: { projectId: "project_1", email: "member@example.com", roles: ["executor"] },
  accept_project_invitation: { invitationId: "project_invitation_1" },
  delete_project_invitation: { invitationId: "project_invitation_1" },
  list_members: { projectId: "project_1" },
  create_member: { projectId: "project_1", name: "成员", email: "member@example.com", roles: ["executor"] },
  update_member: { projectMemberId: "member_1", name: "成员", roles: ["executor"], status: "active" },
  delete_member: { projectMemberId: "member_1", confirmed: true },
  bind_member_to_project: { projectId: "project_1", memberRef: "member_1", roles: ["executor"] },
  unbind_project_member: { projectMemberId: "member_1", confirmed: true },
  create_member_account: { projectId: "project_1", name: "成员", email: "member@example.com", password: "1234", roles: ["executor"] },
  update_member_account: { memberId: "member_1", name: "成员" },
  search: { query: "任务" },
  get_project_overview: { projectId: "project_1" },
  create_project: { name: "项目", description: "说明", taskStageMode: "software" },
  update_project: { projectId: "project_1", name: "项目" },
  archive_project: { projectId: "project_1", confirmed: true },
  restore_project: { projectId: "project_1" },
  get_member_status: { projectId: "project_1" },
  list_pending_reviews: { projectId: "project_1" },
  list_risk_tasks: { projectId: "project_1" },
  list_tasks: { projectId: "project_1", status: "all" },
  get_task: { taskId: "task_1" },
  create_task: { projectId: "project_1", title: "任务" },
  batch_create_tasks: { projectId: "project_1", tasks: [{ title: "任务一" }, { title: "任务二" }] },
  update_task: { taskId: "task_1", title: "任务" },
  delete_task: { taskId: "task_1", confirmed: true },
  assign_task: { taskId: "task_1", primaryExecutorMemberId: "member_1" },
  batch_assign_tasks: { taskIds: ["task_1", "task_2"], primaryExecutorMemberId: "member_1" },
  set_task_status: { taskId: "task_1", status: "completed", confirmed: true },
  update_task_progress: { taskId: "task_1", progressPercent: 50, progressNote: "推进中" },
  split_task: { taskId: "task_1", childTitles: ["子任务一", "子任务二"], confirmed: true },
  get_today_plan: { date: "2026-07-06" },
  get_today_workbench: { projectId: "project_1" },
  add_task_to_today: { taskId: "task_1" },
  batch_add_tasks_to_today: { taskIds: ["task_1", "task_2"] },
  remove_task_from_today: { taskId: "task_1" },
  move_today_task: { taskId: "task_1", direction: 1 },
  schedule_task_for_date: { taskId: "task_1", date: "2026-07-07" },
  start_task: { taskId: "task_1" },
  pause_work_session: { taskId: "task_1" },
  resume_work_session: { taskId: "task_1" },
  finish_work_session: { taskId: "task_1", outcome: "completed" },
  get_active_work: { projectId: "project_1" },
  record_interruption: { taskId: "task_1", type: "external", note: "电话", action: "defer" },
  submit_task_review: { taskId: "task_1" },
  accept_task_review: { taskId: "task_1", confirmed: true },
  return_task_review: { taskId: "task_1", reason: "补充说明" },
  get_daily_summary: { date: "2026-07-06" },
  update_daily_review: { date: "2026-07-06", wins: "完成关键任务" },
  update_settings: { focusMinutes: 30 },
  save_task_template: { name: "模板", priority: "medium", severity: "medium" },
  delete_task_template: { templateId: "template_1", confirmed: true },
  instantiate_task_template: { templateId: "template_1", projectId: "project_1" },
};

const expectedMethodByTool: Record<string, string> = {
  health: "health",
  get_backend_diagnostics: "getBackendDiagnostics",
  get_current_account: "getCurrentAccount",
  list_workspaces: "listWorkspaces",
  switch_workspace: "switchWorkspace",
  create_workspace: "createWorkspace",
  update_workspace: "updateWorkspace",
  update_workspace_membership: "updateWorkspaceMembership",
  list_platform_accounts: "listPlatformAccounts",
  create_platform_account: "createPlatformAccount",
  update_platform_account: "updatePlatformAccount",
  disable_platform_account: "disablePlatformAccount",
  update_platform_account_password: "updatePlatformAccountPassword",
  list_workspace_invitations: "listWorkspaceInvitations",
  invite_workspace_member: "inviteWorkspaceMember",
  accept_workspace_invitation: "acceptWorkspaceInvitation",
  delete_workspace_invitation: "deleteWorkspaceInvitation",
  list_project_invitations: "listProjectInvitations",
  invite_project_member: "inviteProjectMember",
  accept_project_invitation: "acceptProjectInvitation",
  delete_project_invitation: "deleteProjectInvitation",
  list_members: "listMembers",
  create_member: "createMember",
  update_member: "updateMember",
  delete_member: "deleteMember",
  bind_member_to_project: "bindMemberToProject",
  unbind_project_member: "unbindProjectMember",
  create_member_account: "createMemberAccount",
  update_member_account: "updateMemberAccount",
  list_projects: "listProjects",
  search: "search",
  get_project_overview: "getProjectOverview",
  create_project: "createProject",
  update_project: "updateProject",
  archive_project: "archiveProject",
  restore_project: "restoreProject",
  get_member_status: "getMemberStatus",
  list_pending_reviews: "listPendingReviews",
  list_risk_tasks: "listRiskTasks",
  list_tasks: "listTasks",
  get_task: "getTask",
  create_task: "createTask",
  batch_create_tasks: "batchCreateTasks",
  update_task: "updateTask",
  delete_task: "deleteTask",
  assign_task: "assignTask",
  batch_assign_tasks: "batchAssignTasks",
  set_task_status: "setTaskStatus",
  update_task_progress: "updateTaskProgress",
  split_task: "splitTask",
  get_today_plan: "getTodayPlan",
  get_today_workbench: "getTodayWorkbench",
  add_task_to_today: "addTaskToToday",
  batch_add_tasks_to_today: "batchAddTasksToToday",
  remove_task_from_today: "removeTaskFromToday",
  move_today_task: "moveTodayTask",
  schedule_task_for_date: "scheduleTaskForDate",
  start_task: "startTask",
  pause_work_session: "pauseWorkSession",
  resume_work_session: "resumeWorkSession",
  finish_work_session: "finishWorkSession",
  get_active_work: "getActiveWork",
  record_interruption: "recordInterruption",
  submit_task_review: "submitTaskReview",
  accept_task_review: "acceptTaskReview",
  return_task_review: "returnTaskReview",
  get_daily_summary: "getDailySummary",
  update_daily_review: "updateDailyReview",
  get_settings: "getSettings",
  update_settings: "updateSettings",
  list_task_templates: "listTaskTemplates",
  save_task_template: "saveTaskTemplate",
  delete_task_template: "deleteTaskTemplate",
  instantiate_task_template: "instantiateTaskTemplate",
};

const registerToolsWithClient = () => {
  const tools = new Map<string, RegisteredTool>();
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const server = {
    registerTool(name: string, config: RegisteredTool["config"], callback: RegisteredTool["callback"]) {
      tools.set(name, { config, callback });
    },
  } as unknown as McpServer;
  const client = new Proxy({}, {
    get: (_target, key) => (...args: unknown[]) => {
      calls.push({ method: String(key), args });
      return Promise.resolve({ method: String(key), args });
    },
  }) as TimeManageMcpClientType;
  registerTimeManageTools(server, client);
  return { tools, calls };
};

describe("TimeManage MCP tool registration", () => {
  it("registers the complete public tool surface", () => {
    const { tools } = registerToolsWithClient();

    expect(Array.from(tools.keys()).sort()).toEqual([...expectedTools].sort());
    expectedTools.forEach((name) => {
      expect(tools.get(name)?.config.description).toBeTruthy();
      expect(tools.get(name)?.config.annotations?.openWorldHint).toBe(false);
    });
  });

  it("dispatches every registered tool to the expected client method", async () => {
    for (const toolName of expectedTools) {
      const { tools, calls } = registerToolsWithClient();
      const tool = tools.get(toolName);
      expect(tool, toolName).toBeDefined();

      const result = await tool!.callback(sampleInputs[toolName] ?? {});
      expect(result.isError, toolName).not.toBe(true);
      expect(calls.map((call) => call.method), toolName).toContain(expectedMethodByTool[toolName]);
    }
  });

});
