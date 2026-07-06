import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TimeManageMcpClient } from "../core.js";
import {
  accountStatusSchema,
  projectMemberRoleSchema,
  workspaceMemberStatusSchema,
  workspaceRoleSchema,
  workspaceTypeSchema,
} from "../schemas.js";
import { confirmedShape, registerJsonTool } from "./helpers.js";

export const registerSystemTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(server, "health", "检查 MCP 与团队后台是否可连接。", {}, () => client.health(), true);
  registerJsonTool(server, "get_backend_diagnostics", "读取 MCP 视角下的后台诊断和业务实体数量。", {}, () => client.getBackendDiagnostics(), true);
  registerJsonTool(server, "get_current_account", "读取当前登录账号、当前工作区和成员身份。", {}, () => client.getCurrentAccount(), true);
  registerJsonTool(server, "list_workspaces", "列出当前账号可访问的工作区和工作区成员关系。", {}, () => client.listWorkspaces(), true);
  registerJsonTool(server, "switch_workspace", "切换当前 MCP 会话的工作区。", { workspaceId: z.string() }, ({ workspaceId }) => client.switchWorkspace(workspaceId));
};

export const registerWorkspaceTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(server, "create_workspace", "创建共享工作区。", { name: z.string() }, ({ name }) => client.createWorkspace(name));
  registerJsonTool(
    server,
    "update_workspace",
    "更新工作区名称、类型或负责人。",
    { workspaceId: z.string(), name: z.string(), type: workspaceTypeSchema, ownerAccountId: z.string().optional() },
    ({ workspaceId, name, type, ownerAccountId }) => client.updateWorkspace(workspaceId, { name, type, ownerAccountId }),
  );
  registerJsonTool(
    server,
    "update_workspace_membership",
    "更新工作区成员角色或状态。",
    {
      workspaceId: z.string(),
      membershipId: z.string(),
      role: workspaceRoleSchema.optional(),
      status: workspaceMemberStatusSchema.optional(),
    },
    ({ workspaceId, membershipId, role, status }) => client.updateWorkspaceMembership(workspaceId, membershipId, { role, status }),
  );
};

export const registerAccountTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(server, "list_platform_accounts", "列出平台账号库。", {}, () => client.listPlatformAccounts(), true);
  registerJsonTool(
    server,
    "create_platform_account",
    "创建平台账号。",
    { name: z.string(), email: z.string(), password: z.string(), status: accountStatusSchema.optional() },
    ({ name, email, password, status }) => client.createPlatformAccount({ name, email, password, status }),
  );
  registerJsonTool(
    server,
    "update_platform_account",
    "更新平台账号资料或状态。",
    { accountId: z.string(), name: z.string().optional(), email: z.string().optional(), password: z.string().optional(), status: accountStatusSchema.optional() },
    ({ accountId, ...input }) => client.updatePlatformAccount(accountId, input),
  );
  registerJsonTool(
    server,
    "disable_platform_account",
    "停用平台账号。需要 confirmed=true。",
    { accountId: z.string(), ...confirmedShape },
    ({ accountId, confirmed }) => {
      if (!confirmed) throw new Error("disable_platform_account requires explicit user confirmation.");
      return client.disablePlatformAccount(accountId);
    },
  );
  registerJsonTool(
    server,
    "update_platform_account_password",
    "更新平台账号密码。",
    { accountId: z.string(), password: z.string() },
    ({ accountId, password }) => client.updatePlatformAccountPassword(accountId, password),
  );
};

export const registerInvitationTools = (server: McpServer, client: TimeManageMcpClient) => {
  registerJsonTool(server, "list_workspace_invitations", "列出当前账号相关的工作区邀请。", {}, () => client.listWorkspaceInvitations(), true);
  registerJsonTool(
    server,
    "invite_workspace_member",
    "邀请平台账号加入工作区。",
    { workspaceId: z.string(), email: z.string() },
    ({ workspaceId, email }) => client.inviteWorkspaceMember(workspaceId, email),
  );
  registerJsonTool(server, "accept_workspace_invitation", "接受工作区邀请。", { invitationId: z.string() }, ({ invitationId }) => client.acceptWorkspaceInvitation(invitationId));
  registerJsonTool(server, "delete_workspace_invitation", "删除工作区邀请。", { invitationId: z.string() }, ({ invitationId }) => client.deleteWorkspaceInvitation(invitationId));
  registerJsonTool(server, "list_project_invitations", "列出当前账号相关的项目邀请。", {}, () => client.listProjectInvitations(), true);
  registerJsonTool(
    server,
    "invite_project_member",
    "邀请平台账号加入项目。",
    { workspaceId: z.string().optional(), projectId: z.string(), email: z.string(), roles: z.array(projectMemberRoleSchema).optional() },
    ({ workspaceId, projectId, email, roles }) => client.inviteProjectMember({ workspaceId, projectId, email, roles: roles?.length ? roles : ["executor"] }),
  );
  registerJsonTool(server, "accept_project_invitation", "接受项目邀请。", { invitationId: z.string() }, ({ invitationId }) => client.acceptProjectInvitation(invitationId));
  registerJsonTool(server, "delete_project_invitation", "删除项目邀请。", { invitationId: z.string() }, ({ invitationId }) => client.deleteProjectInvitation(invitationId));
};
