import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireConfirmation, type TimeManageMcpClient } from "../core.js";
import { handle, projectMemberRoleSchema } from "../toolShared.js";

export function registerMemberTools(server: McpServer, client: TimeManageMcpClient) {
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
}
