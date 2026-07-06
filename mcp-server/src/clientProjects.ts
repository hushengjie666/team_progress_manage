import type { ProjectMemberRole } from "../../src/types.js";
import {
  archiveProjectInTeamState,
  bindMemberToProjectInTeamState,
  createProjectInTeamState,
  createProjectMemberInTeamState,
  restoreProjectInTeamState,
  unbindProjectMemberInTeamState,
  updateProjectInTeamState,
  updateProjectMemberInTeamState,
} from "./businessProjectMemberOperations.js";
import type { MemberInput, ProjectInput } from "./businessTypes.js";
import { TimeManageMcpBaseClient } from "./clientBase.js";
import { requireConfirmation } from "./toolResult.js";
import {
  compactMember,
  compactProject,
  listProjectViews,
  projectOverviewView,
  riskTasksView,
  searchView,
} from "./views.js";

export class TimeManageMcpProjectClient extends TimeManageMcpBaseClient {
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
    const saved = await this.mutate(undefined, (state, timestamp) => {
      const next = createProjectInTeamState(state, input, timestamp);
      const project = next.projects.find((item) => !state.projects.some((existing) => existing.id === item.id));
      return { state: next, result: project?.id };
    });
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === saved.result)!);
  }

  async updateProject(projectId: string, input: Partial<ProjectInput>) {
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: updateProjectInTeamState(state, projectId, input, timestamp),
      result: projectId,
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId)!);
  }

  async archiveProject(projectId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "archive_project");
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: archiveProjectInTeamState(state, projectId, timestamp),
      result: projectId,
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId)!);
  }

  async restoreProject(projectId: string) {
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: restoreProjectInTeamState(state, projectId, timestamp),
      result: projectId,
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId)!);
  }

  async listMembers(projectId?: string, includeDisabled = false) {
    const state = await this.authenticatedState();
    return state.projectMembers
      .filter((member) => (!projectId || member.projectId === projectId) && (includeDisabled || member.status !== "disabled"))
      .map((member) => compactMember(state, member));
  }

  async createMember(input: MemberInput) {
    const saved = await this.mutate(input.projectId, (state, timestamp) => {
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
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === saved.result)!);
  }

  async updateMember(projectMemberId: string, input: Parameters<typeof updateProjectMemberInTeamState>[2]) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: updateProjectMemberInTeamState(state, projectMemberId, input, timestamp),
      result: projectMemberId,
    }));
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === projectMemberId)!);
  }

  async deleteMember(projectMemberId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "delete_member");
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: unbindProjectMemberInTeamState(state, projectMemberId, timestamp),
      result: projectMemberId,
    }));
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === projectMemberId)!);
  }

  async bindMemberToProject(projectId: string, memberRef: string, roles: ProjectMemberRole[]) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      const next = bindMemberToProjectInTeamState(state, projectId, memberRef, roles, timestamp);
      const member = next.projectMembers.find((item) => !state.projectMembers.some((existing) => existing.id === item.id));
      return { state: next, result: member?.id };
    });
    return saved.result ? compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === saved.result)!) : undefined;
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
