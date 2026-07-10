import type { Command } from "commander/esm.mjs";
import {
  addDataOption,
  parseData,
  resolveAccountId,
  resolveMemberId,
  resolveWorkspaceInvitationId,
  resolveWorkspaceId,
  resolveWorkspaceMembershipId,
  type CliRuntime,
} from "../commandSupport.js";
import type { TimeManageClient } from "../client.js";

export function registerAccountWorkspaceCommands(program: Command, runtime: CliRuntime) {
  const account = program.command("account").description("账号操作");
  account.command("show").description("查看当前账号").action(async () => runtime.output(await runtime.client().getCurrentAccount()));

  const platform = account.command("platform").description("平台账号管理");
  platform.command("list").action(async () => runtime.output(await runtime.client().listPlatformAccounts()));
  addDataOption(platform.command("create"))
    .action(async (options) => runtime.output(await runtime.client().createPlatformAccount(
      parseData<Parameters<TimeManageClient["createPlatformAccount"]>[0]>(options.data),
    )));
  addDataOption(platform.command("update").argument("<account>"))
    .action(async (accountRef, options) => {
      const client = runtime.client();
      runtime.output(await client.updatePlatformAccount(
        await resolveAccountId(client, accountRef),
        parseData<Parameters<TimeManageClient["updatePlatformAccount"]>[1]>(options.data),
      ));
    });
  platform.command("disable <account>").action(async (accountRef) => {
    const client = runtime.client();
    runtime.output(await client.disablePlatformAccount(await resolveAccountId(client, accountRef)));
  });
  platform.command("password <account>")
    .requiredOption("--password <password>")
    .action(async (accountRef, options) => {
      const client = runtime.client();
      runtime.output(await client.updatePlatformAccountPassword(await resolveAccountId(client, accountRef), options.password));
    });

  const memberAccount = account.command("member").description("项目成员账号管理");
  addDataOption(memberAccount.command("create"))
    .action(async (options) => runtime.output(await runtime.client().createMemberAccount(
      parseData<Parameters<TimeManageClient["createMemberAccount"]>[0]>(options.data),
    )));
  addDataOption(memberAccount.command("update").argument("<member>"))
    .action(async (memberRef, options) => {
      const client = runtime.client();
      runtime.output(await client.updateMemberAccount(
        await resolveMemberId(client, memberRef),
        parseData<Parameters<TimeManageClient["updateMemberAccount"]>[1]>(options.data),
      ));
    });

  const workspace = program.command("workspace").description("工作区操作");
  workspace.command("list").action(async () => runtime.output(await runtime.client().listWorkspaces()));
  workspace.command("switch <workspace>").action(async (workspaceRef) => {
    const client = runtime.client();
    runtime.output(await client.switchWorkspace(await resolveWorkspaceId(client, workspaceRef)));
  });
  workspace.command("create").requiredOption("--name <name>").action(async (options) =>
    runtime.output(await runtime.client().createWorkspace(options.name)));
  addDataOption(workspace.command("update").argument("<workspace>"))
    .action(async (workspaceRef, options) => {
      const client = runtime.client();
      runtime.output(await client.updateWorkspace(
        await resolveWorkspaceId(client, workspaceRef),
        parseData<Parameters<TimeManageClient["updateWorkspace"]>[1]>(options.data),
      ));
    });

  addDataOption(workspace.command("member").command("update <workspace> <membership>"))
    .action(async (workspaceRef, membershipRef, options) => {
      const client = runtime.client();
      const workspaceId = await resolveWorkspaceId(client, workspaceRef);
      runtime.output(await client.updateWorkspaceMembership(
        workspaceId,
        await resolveWorkspaceMembershipId(client, membershipRef, workspaceId),
        parseData<Parameters<TimeManageClient["updateWorkspaceMembership"]>[2]>(options.data),
      ));
    });

  const invitation = workspace.command("invitation").description("工作区邀请");
  invitation.command("list").action(async () => runtime.output(await runtime.client().listWorkspaceInvitations()));
  invitation.command("invite <workspace>").requiredOption("--email <email>").action(async (workspaceRef, options) => {
    const client = runtime.client();
    runtime.output(await client.inviteWorkspaceMember(await resolveWorkspaceId(client, workspaceRef), options.email));
  });
  invitation.command("accept <invitation>").action(async (invitationRef) => {
    const client = runtime.client();
    runtime.output(await client.acceptWorkspaceInvitation(await resolveWorkspaceInvitationId(client, invitationRef)));
  });
  invitation.command("delete <invitation>").action(async (invitationRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteWorkspaceInvitation(await resolveWorkspaceInvitationId(client, invitationRef)));
  });
}
