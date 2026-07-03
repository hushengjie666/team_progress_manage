import { addProjectMemberToState, updateProjectMemberInState } from "../../src/teamProgress.js";
import type { ProjectMember, ProjectMemberRole } from "../../src/types.js";
import { uid } from "../../src/seed.js";
import { TimeManageMcpProjectClient } from "./coreProjects.js";
import { unbindProjectMemberInState, uniqueProjectMembers } from "./coreProjectModel.js";
import type { CreateMemberInput, UpdateMemberInput } from "./coreTypes.js";

export class TimeManageMcpMemberClient extends TimeManageMcpProjectClient {
  async listMembers(projectId?: string, includeDisabled = false) {
    const state = await this.readState(projectId);
    const members = projectId
      ? state.projectMembers.filter((member) => member.projectId === projectId)
      : uniqueProjectMembers(state.projectMembers);
    return members.filter((member) => includeDisabled || member.status !== "disabled");
  }

  async createMember(input: CreateMemberInput) {
    return this.mutate(input.projectId, (state, timestamp) => {
      const project = state.projects.find((item) => item.id === input.projectId);
      if (!project) throw new Error(`Project not found: ${input.projectId}`);
      const next = addProjectMemberToState(state, input.projectId, input.name, input.email ?? "", input.roles ?? ["executor"], timestamp, uid, {
        accountId: input.accountId,
        workspaceId: project.workspaceId,
      });
      const normalizedEmail = input.email?.trim().toLowerCase();
      const created = next.projectMembers.find(
        (member) =>
          member.projectId === input.projectId &&
          (
            (input.accountId && member.accountId === input.accountId) ||
            (normalizedEmail && member.email?.toLowerCase() === normalizedEmail) ||
            member.name === (input.name.trim() || "新成员")
          ),
      );
      if (!created) throw new Error("Project member was not created. Check member input.");
      return { state: next, result: created };
    });
  }

  async updateMember(projectMemberId: string, input: UpdateMemberInput) {
    return this.mutate(undefined, (state, timestamp) => {
      const member = state.projectMembers.find((item) => item.id === projectMemberId);
      if (!member) throw new Error(`Project member not found: ${projectMemberId}`);
      const nextMember: ProjectMember = {
        ...member,
        name: input.name?.trim() || member.name,
        email: input.email === undefined ? member.email : input.email.trim() || undefined,
        status: input.status ?? member.status ?? "active",
      };
      const next = updateProjectMemberInState(state, nextMember, timestamp);
      return { state: next, result: next.projectMembers.find((item) => item.id === projectMemberId)! };
    });
  }

  async deleteMember(projectMemberId: string) {
    return this.mutate(undefined, (state, timestamp) => {
      if (!state.projectMembers.some((member) => member.id === projectMemberId)) throw new Error(`Project member not found: ${projectMemberId}`);
      return { state: unbindProjectMemberInState(state, projectMemberId, timestamp), result: { deletedProjectMemberId: projectMemberId } };
    });
  }

  async bindMemberToProject(projectId: string, memberRef: string, roles: ProjectMemberRole[] = ["executor"]) {
    return this.mutate(projectId, (state, timestamp) => {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const normalizedRef = memberRef.trim().toLowerCase();
      const source = state.projectMembers.find(
        (member) =>
          member.id === memberRef ||
          member.accountId === memberRef ||
          member.email?.toLowerCase() === normalizedRef,
      );
      if (!source) throw new Error(`Project member source not found: ${memberRef}`);
      const next = addProjectMemberToState(state, projectId, source.name, source.email ?? "", roles, timestamp, uid, {
        accountId: source.accountId,
        workspaceId: project.workspaceId ?? source.workspaceId,
      });
      const projectMember = next.projectMembers.find(
        (member) =>
          member.projectId === projectId &&
          (
            (source.accountId && member.accountId === source.accountId) ||
            (source.email && member.email?.toLowerCase() === source.email.toLowerCase()) ||
            member.name === source.name
          ),
      );
      return { state: next, result: projectMember };
    });
  }

  async updateProjectMember(projectMemberId: string, input: { roles?: ProjectMemberRole[]; status?: "active" | "disabled" }) {
    return this.mutate(undefined, (state, timestamp) => {
      const projectMember = state.projectMembers.find((member) => member.id === projectMemberId);
      if (!projectMember) throw new Error(`Project member not found: ${projectMemberId}`);
      const next = updateProjectMemberInState(state, {
        ...projectMember,
        roles: input.roles ?? projectMember.roles,
        status: input.status ?? projectMember.status ?? "active",
      }, timestamp);
      return { state: next, result: next.projectMembers.find((member) => member.id === projectMemberId)! };
    });
  }

  async unbindProjectMember(projectMemberId: string) {
    return this.mutate(undefined, (state, timestamp) => ({
      state: unbindProjectMemberInState(state, projectMemberId, timestamp),
      result: { unboundProjectMemberId: projectMemberId },
    }));
  }
}
