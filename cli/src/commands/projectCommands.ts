import type { Command } from "commander/esm.mjs";
import type { ProjectMemberRole } from "../../../src/types.js";
import {
  addDataOption,
  enumValue,
  numberValue,
  parseData,
  resolveMemberId,
  resolveProjectInvitationId,
  resolveProjectId,
  resolveWorkspaceId,
  splitList,
  type CliRuntime,
} from "../commandSupport.js";
import type { TimeManageClient } from "../client.js";

const projectRoles = (value: string) => {
  const roles = splitList(value);
  if (roles.some((role) => role !== "project_owner" && role !== "executor")) {
    throw new Error("--roles must contain project_owner or executor.");
  }
  return roles as ProjectMemberRole[];
};

export function registerProjectCommands(program: Command, runtime: CliRuntime) {
  const project = program.command("project").description("项目操作");
  project.command("list").action(async () => runtime.output(await runtime.client().listProjects()));
  project.command("show <project>").action(async (projectRef) => {
    const client = runtime.client();
    runtime.output(await client.getProjectOverview(await resolveProjectId(client, projectRef)));
  });
  project.command("create")
    .requiredOption("--name <name>")
    .option("--description <description>")
    .option("--workspace <workspace-id>")
    .option("--mode <regular-or-software>")
    .option("--expected-start-hours <hours>")
    .action(async (options) => {
      const client = runtime.client();
      runtime.output(await client.createProject({
        name: options.name,
        description: options.description,
        workspaceId: options.workspace ? await resolveWorkspaceId(client, options.workspace) : undefined,
        taskStageMode: options.mode ? enumValue(options.mode, "mode", ["regular", "software"] as const) : undefined,
        defaultExpectedStartHours: options.expectedStartHours === undefined
          ? undefined
          : numberValue(options.expectedStartHours, "expected-start-hours", 0),
      }));
    });
  addDataOption(project.command("update").argument("<project>"))
    .action(async (projectRef, options) => {
      const client = runtime.client();
      runtime.output(await client.updateProject(
        await resolveProjectId(client, projectRef),
        parseData<Parameters<TimeManageClient["updateProject"]>[1]>(options.data),
      ));
    });
  project.command("archive <project>").requiredOption("--yes", "确认归档").action(async (projectRef) => {
    const client = runtime.client();
    runtime.output(await client.archiveProject(await resolveProjectId(client, projectRef), true));
  });
  project.command("restore <project>").action(async (projectRef) => {
    const client = runtime.client();
    runtime.output(await client.restoreProject(await resolveProjectId(client, projectRef)));
  });
  project.command("risks").option("--project <project>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.listRiskTasks(options.project ? await resolveProjectId(client, options.project) : undefined));
  });

  const invitation = project.command("invitation").description("项目邀请");
  invitation.command("list").action(async () => runtime.output(await runtime.client().listProjectInvitations()));
  invitation.command("invite <project>")
    .requiredOption("--email <email>")
    .requiredOption("--roles <roles>")
    .option("--workspace <workspace-id>")
    .action(async (projectRef, options) => {
      const client = runtime.client();
      runtime.output(await client.inviteProjectMember({
        projectId: await resolveProjectId(client, projectRef),
        workspaceId: options.workspace ? await resolveWorkspaceId(client, options.workspace) : undefined,
        email: options.email,
        roles: projectRoles(options.roles),
      }));
    });
  invitation.command("accept <invitation>").action(async (invitationRef) => {
    const client = runtime.client();
    runtime.output(await client.acceptProjectInvitation(await resolveProjectInvitationId(client, invitationRef)));
  });
  invitation.command("delete <invitation>").action(async (invitationRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteProjectInvitation(await resolveProjectInvitationId(client, invitationRef)));
  });

  const member = project.command("member").description("项目成员");
  member.command("list").option("--project <project>").option("--include-disabled").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.listMembers(
      options.project ? await resolveProjectId(client, options.project) : undefined,
      Boolean(options.includeDisabled),
    ));
  });
  addDataOption(member.command("create").argument("<project>"))
    .action(async (projectRef, options) => {
      const client = runtime.client();
      runtime.output(await client.createMember({
        ...parseData<Omit<Parameters<TimeManageClient["createMember"]>[0], "projectId">>(options.data),
        projectId: await resolveProjectId(client, projectRef),
      }));
    });
  addDataOption(member.command("update").argument("<member>"))
    .action(async (memberRef, options) => {
      const client = runtime.client();
      runtime.output(await client.updateProjectMember(
        await resolveMemberId(client, memberRef),
        parseData<Parameters<TimeManageClient["updateProjectMember"]>[1]>(options.data),
      ));
    });
  member.command("delete <member>").requiredOption("--yes", "确认删除成员").action(async (memberRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteMember(await resolveMemberId(client, memberRef), true));
  });
  member.command("bind <project> <member>").requiredOption("--roles <roles>").action(async (projectRef, memberRef, options) => {
    const client = runtime.client();
    runtime.output(await client.bindMemberToProject(
      await resolveProjectId(client, projectRef),
      memberRef,
      projectRoles(options.roles),
    ));
  });
  member.command("unbind <member>").requiredOption("--yes", "确认解除项目绑定").action(async (memberRef) => {
    const client = runtime.client();
    runtime.output(await client.unbindProjectMember(await resolveMemberId(client, memberRef), true));
  });
}
