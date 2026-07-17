import { canManageProjectMembers } from "./accessControl";
import { nowIso } from "./appModel";
import { uid } from "./seed";
import {
  addProjectMemberToState,
  createProjectInState,
  reorderProjectsInState,
} from "./teamProgress";
import { isSuperAdminAccount } from "./workspaceAccountRuntime";
import type {
  AppState,
  Project,
  ProjectMember,
  ProjectMemberRole,
  TaskStageMode,
} from "./types";
import type { RunTeamDomainCommand } from "./teamDomainCommands";

type AccessibleMemberInput = {
  accountId?: string;
  name: string;
  email?: string;
  workspaceId?: string;
  roles: ProjectMemberRole[];
};

export type AppProjectActionsRuntimeOptions = {
  getState: () => AppState;
  runTeamCommand: RunTeamDomainCommand;
  setToast: (message: string) => void;
};

export type AppProjectActionsRuntime = {
  createProject: (name: string, description: string, workspaceId?: string, taskStageMode?: TaskStageMode) => void;
  updateProject: (project: Project) => void;
  reorderProjects: (projectIds: string[]) => void;
  canManageProjectMembersForProject: (source: AppState, projectId: string) => boolean;
  bindAccessibleMemberToProject: (projectId: string, input: AccessibleMemberInput) => void;
  updateProjectMember: (member: ProjectMember) => void;
};

export function createAppProjectActionsRuntime({
  getState,
  runTeamCommand,
  setToast,
}: AppProjectActionsRuntimeOptions): AppProjectActionsRuntime {
  const createProject = (name: string, description: string, workspaceId?: string, taskStageMode: TaskStageMode = "regular") => {
    const projectName = name.trim();
    if (!projectName) {
      setToast("项目名称不能为空");
      return;
    }
    const timestamp = nowIso();
    const source = getState();
    const next = createProjectInState(source, projectName, description, timestamp, uid, {
      accountId: source.auth.account?.id,
      name: source.auth.account?.name,
      email: source.auth.account?.email,
      workspaceId: workspaceId || source.auth.workspace?.id,
      taskStageMode,
    });
    const project = next.projects.find((item) => !source.projects.some((current) => current.id === item.id));
    if (!project) return;
    void runTeamCommand({ kind: "create", entity: "project", workspaceId: project.workspaceId, payload: project as unknown as Record<string, unknown> })
      .then((saved) => saved && setToast("项目已创建"));
  };

  const updateProject = (project: Project) => {
    const current = getState().projects.find((item) => item.id === project.id);
    if (current?.workspaceId && project.workspaceId && current.workspaceId !== project.workspaceId) {
      void runTeamCommand({
        kind: "action",
        resource: "projects",
        id: project.id,
        action: "move",
        workspaceId: current.workspaceId,
        payload: { target_workspace_id: project.workspaceId, patch: project as unknown as Record<string, unknown> },
        idempotencyKey: `project-move-${project.id}-${project.workspaceId}`,
      });
      return;
    }
    void runTeamCommand({
      kind: "patch",
      entity: "project",
      id: project.id,
      workspaceId: project.workspaceId,
      patch: project as unknown as Record<string, unknown>,
    });
  };

  const reorderProjects = (projectIds: string[]) => {
    const source = getState();
    const reordered = reorderProjectsInState(source, projectIds, nowIso());
    for (const project of reordered.projects) {
      if (source.projects.find((item) => item.id === project.id)?.sortOrder !== project.sortOrder) {
        void runTeamCommand({ kind: "patch", entity: "project", id: project.id, workspaceId: project.workspaceId, patch: { sortOrder: project.sortOrder } });
      }
    }
  };

  const canManageProjectMembersForProject = (source: AppState, projectId: string) => {
    if (isSuperAdminAccount(source.auth.account)) return true;
    return canManageProjectMembers(source, projectId);
  };

  const bindAccessibleMemberToProject = (projectId: string, input: AccessibleMemberInput) => {
    const source = getState();
    const next = addProjectMemberToState(source, projectId, input.name, input.email ?? "", input.roles, nowIso(), uid, {
      accountId: input.accountId,
      workspaceId: input.workspaceId,
    });
    const member = next.projectMembers.find((item) => !source.projectMembers.some((current) => current.id === item.id));
    if (!member) return;
    void runTeamCommand({ kind: "create", entity: "project_member", workspaceId: member.workspaceId, payload: member as unknown as Record<string, unknown> })
      .then((saved) => saved && setToast("项目成员绑定已更新"));
  };

  const updateProjectMember = (member: ProjectMember) => {
    void runTeamCommand({ kind: "patch", entity: "project_member", id: member.id, workspaceId: member.workspaceId, patch: member as unknown as Record<string, unknown> });
  };

  return {
    createProject,
    updateProject,
    reorderProjects,
    canManageProjectMembersForProject,
    bindAccessibleMemberToProject,
    updateProjectMember,
  };
}
