import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TimeManageMcpClient } from "../core.js";
import {
  accountStatusSchema,
  projectMemberRoleSchema,
  workspaceMemberStatusSchema,
} from "../schemas.js";
import { confirmedShape, registerJsonTool } from "./helpers.js";

export const registerMemberTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(
    server,
    "list_members",
    "列出项目成员绑定。",
    { projectId: z.string().optional(), includeDisabled: z.boolean().optional() },
    ({ projectId, includeDisabled }) => client.listMembers(projectId, includeDisabled),
    true,
  );
  registerJsonTool(
    server,
    "create_member",
    "创建项目成员绑定。",
    { projectId: z.string(), name: z.string(), email: z.string().optional(), accountId: z.string().optional(), roles: z.array(projectMemberRoleSchema).optional() },
    (input) => client.createMember(input),
  );
  registerJsonTool(
    server,
    "update_member",
    "更新项目成员绑定资料、角色或状态。",
    {
      projectMemberId: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
      roles: z.array(projectMemberRoleSchema).optional(),
      status: workspaceMemberStatusSchema.optional(),
    },
    ({ projectMemberId, ...input }) => client.updateMember(projectMemberId, input),
  );
  registerJsonTool(
    server,
    "delete_member",
    "停用项目成员绑定。需要 confirmed=true。",
    { projectMemberId: z.string(), ...confirmedShape },
    ({ projectMemberId, confirmed }) => client.deleteMember(projectMemberId, confirmed),
  );
  registerJsonTool(
    server,
    "bind_member_to_project",
    "把已有成员身份绑定到另一个项目。",
    { projectId: z.string(), memberRef: z.string(), roles: z.array(projectMemberRoleSchema).optional() },
    ({ projectId, memberRef, roles }) => client.bindMemberToProject(projectId, memberRef, roles ?? ["executor"]),
  );
  registerJsonTool(
    server,
    "unbind_project_member",
    "停用项目成员绑定。需要 confirmed=true。",
    { projectMemberId: z.string(), ...confirmedShape },
    ({ projectMemberId, confirmed }) => client.unbindProjectMember(projectMemberId, confirmed),
  );
  registerJsonTool(
    server,
    "create_member_account",
    "创建平台账号并写入项目成员。",
    {
      workspaceId: z.string().optional(),
      projectId: z.string().optional(),
      name: z.string(),
      email: z.string(),
      password: z.string(),
      roles: z.array(projectMemberRoleSchema).optional(),
      status: accountStatusSchema.optional(),
    },
    ({ roles, ...input }) => client.createMemberAccount({ ...input, roles: roles?.length ? roles : ["executor"] }),
  );
  registerJsonTool(
    server,
    "update_member_account",
    "更新项目成员关联的平台账号资料。",
    {
      memberId: z.string(),
      workspaceId: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      password: z.string().optional(),
      roles: z.array(projectMemberRoleSchema).optional(),
      status: accountStatusSchema.optional(),
    },
    ({ memberId, ...input }) => client.updateMemberAccount(memberId, input),
  );
};

export const registerProjectTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(server, "list_projects", "列出当前账号可访问的项目。", {}, () => client.listProjects(), true);
  registerJsonTool(server, "search", "按关键字搜索项目、成员和任务。", { query: z.string(), limit: z.number().optional() }, ({ query, limit }) => client.search(query, limit), true);
  registerJsonTool(server, "get_project_overview", "读取项目进度、风险、成员和活跃工作概览。", { projectId: z.string() }, ({ projectId }) => client.getProjectOverview(projectId), true);
  registerJsonTool(
    server,
    "create_project",
    "创建项目，并把当前账号设为项目负责人。",
    {
      name: z.string(),
      description: z.string().optional(),
      defaultExpectedStartHours: z.number().optional(),
      taskStageMode: z.enum(["regular", "software"]).optional(),
      workspaceId: z.string().optional(),
    },
    (input) => client.createProject(input),
  );
  registerJsonTool(
    server,
    "update_project",
    "更新项目基础设置。",
    {
      projectId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      defaultExpectedStartHours: z.number().optional(),
      taskStageMode: z.enum(["regular", "software"]).optional(),
    },
    ({ projectId, ...input }) => client.updateProject(projectId, input),
  );
  registerJsonTool(server, "archive_project", "归档项目。需要 confirmed=true。", { projectId: z.string(), ...confirmedShape }, ({ projectId, confirmed }) => client.archiveProject(projectId, confirmed));
  registerJsonTool(server, "restore_project", "恢复已归档项目。", { projectId: z.string() }, ({ projectId }) => client.restoreProject(projectId));
  registerJsonTool(
    server,
    "get_member_status",
    "读取成员今日任务状态。",
    { projectId: z.string().optional(), date: z.string().optional() },
    ({ projectId, date }) => client.getMemberStatus(projectId, date),
    true,
  );
  registerJsonTool(server, "list_pending_reviews", "列出待验收任务。", { projectId: z.string().optional() }, ({ projectId }) => client.listPendingReviews(projectId), true);
  registerJsonTool(server, "list_risk_tasks", "列出项目风险任务。", { projectId: z.string().optional() }, ({ projectId }) => client.listRiskTasks(projectId), true);
};
