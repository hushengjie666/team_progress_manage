import type { ProjectMemberRole } from "../../src/types.js";
import {
  bindMemberToProjectInTeamState,
  createProjectInTeamState,
  createProjectMemberInTeamState,
  updateProjectMemberInTeamState,
} from "./businessProjectMemberOperations.js";
import type { MemberInput, ProjectInput } from "./businessTypes.js";
import { TimeManageBaseClient } from "./clientBase.js";
import { requireConfirmation } from "./confirmation.js";
import {
  compactMember,
  compactProject,
  listProjectViews,
  projectOverviewView,
  riskTasksView,
  searchView,
} from "./views.js";

export class TimeManageProjectClient extends TimeManageBaseClient {
  async listProjects() {
    return listProjectViews(await this.authenticatedState());
  }

  async search(query: string, limit?: number) {
    return searchView(await this.authenticatedState(), query, limit);
  }

  async getProjectOverview(projectId: string) {
    return projectOverviewView(await this.authenticatedState(), projectId);
  }

  async createProject(input: ProjectInput) {
    const prepared = await this.prepareMutation((state, timestamp) => {
      const next = createProjectInTeamState(state, input, timestamp);
      const project = next.projects.find((item) => !state.projects.some((existing) => existing.id === item.id));
      return { state: next, result: project?.id };
    });
    const project = prepared.output.state.projects.find((item) => item.id === prepared.output.result)!;
    const saved = await this.runBusinessCommand({ kind: "create", entity: "project", workspaceId: project.workspaceId, payload: project as unknown as Record<string, unknown> });
    return compactProject(saved.state, saved.state.projects.find((item) => item.id === project.id)!);
  }

  async updateProject(projectId: string, input: Partial<ProjectInput>) {
    const current = (await this.authenticatedState()).projects.find((project) => project.id === projectId)!;
    const saved = await this.runBusinessCommand(input.workspaceId && current.workspaceId && input.workspaceId !== current.workspaceId
      ? {
          kind: "action",
          resource: "projects",
          id: projectId,
          action: "move",
          workspaceId: current.workspaceId,
          payload: { target_workspace_id: input.workspaceId, patch: input as Record<string, unknown> },
          idempotencyKey: `cli-project-move-${projectId}-${input.workspaceId}`,
        }
      : { kind: "patch", entity: "project", id: projectId, workspaceId: current.workspaceId, patch: input as Record<string, unknown> });
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId)!);
  }

  async archiveProject(projectId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "archive_project");
    const current = (await this.authenticatedState()).projects.find((project) => project.id === projectId)!;
    const saved = await this.runBusinessCommand({ kind: "patch", entity: "project", id: projectId, workspaceId: current.workspaceId, patch: { archivedAt: new Date().toISOString() } });
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId)!);
  }

  async restoreProject(projectId: string) {
    const current = (await this.authenticatedState()).projects.find((project) => project.id === projectId)!;
    const saved = await this.runBusinessCommand({ kind: "patch", entity: "project", id: projectId, workspaceId: current.workspaceId, patch: { archivedAt: null } });
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId)!);
  }

  async listMembers(projectId?: string, includeDisabled = false) {
    const state = await this.authenticatedState();
    return state.projectMembers
      .filter((member) => (!projectId || member.projectId === projectId) && (includeDisabled || member.status !== "disabled"))
      .map((member) => compactMember(state, member));
  }

  async createMember(input: MemberInput) {
    const prepared = await this.prepareMutation((state, timestamp) => {
      const next = createProjectMemberInTeamState(state, input, timestamp);
      const created = next.projectMembers.find((item) => !state.projectMembers.some((existing) => existing.id === item.id));
      const matched = created ?? next.projectMembers.find(
        (member) =>
          member.projectId === input.projectId &&
          (
            (input.accountId && member.accountId === input.accountId) ||
            (input.email && member.email?.toLowerCase() === input.email.toLowerCase()) ||
            member.name === (input.name.trim() || "新成员")
          ),
      );
      return { state: next, result: matched?.id };
    });
    const member = prepared.output.state.projectMembers.find((item) => item.id === prepared.output.result)!;
    const saved = await this.runBusinessCommand({ kind: "create", entity: "project_member", workspaceId: member.workspaceId, payload: member as unknown as Record<string, unknown> });
    return compactMember(saved.state, saved.state.projectMembers.find((item) => item.id === member.id)!);
  }

  async updateMember(projectMemberId: string, input: Parameters<typeof updateProjectMemberInTeamState>[2]) {
    const current = (await this.authenticatedState()).projectMembers.find((member) => member.id === projectMemberId)!;
    const saved = await this.runBusinessCommand({ kind: "patch", entity: "project_member", id: projectMemberId, workspaceId: current.workspaceId, patch: input as Record<string, unknown> });
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === projectMemberId)!);
  }

  async deleteMember(projectMemberId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "delete_member");
    const current = (await this.authenticatedState()).projectMembers.find((member) => member.id === projectMemberId)!;
    const saved = await this.runBusinessCommand({ kind: "delete", entity: "project_member", id: projectMemberId, workspaceId: current.workspaceId });
    return { deletedMemberId: projectMemberId, savedAt: saved.savedAt };
  }

  async bindMemberToProject(projectId: string, memberRef: string, roles: ProjectMemberRole[]) {
    const prepared = await this.prepareMutation((state, timestamp) => {
      const next = bindMemberToProjectInTeamState(state, projectId, memberRef, roles, timestamp);
      const member = next.projectMembers.find((item) => !state.projectMembers.some((existing) => existing.id === item.id));
      return { state: next, result: member?.id };
    });
    if (!prepared.output.result) return undefined;
    const member = prepared.output.state.projectMembers.find((item) => item.id === prepared.output.result)!;
    const saved = await this.runBusinessCommand({ kind: "create", entity: "project_member", workspaceId: member.workspaceId, payload: member as unknown as Record<string, unknown> });
    return compactMember(saved.state, saved.state.projectMembers.find((item) => item.id === member.id)!);
  }

  async updateProjectMember(projectMemberId: string, input: Parameters<typeof updateProjectMemberInTeamState>[2]) {
    return this.updateMember(projectMemberId, input);
  }

  async unbindProjectMember(projectMemberId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "unbind_project_member");
    return this.deleteMember(projectMemberId, true);
  }

  async listRiskTasks(projectId?: string) {
    return riskTasksView(await this.authenticatedState(), projectId);
  }
}
