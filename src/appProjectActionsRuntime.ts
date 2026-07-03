import { canManageProjectMembers } from "./accessControl";
import { nowIso } from "./appModel";
import { uid } from "./seed";
import {
  addProjectMemberToState,
  createProjectInState,
  reorderProjectsInState,
  updateProjectInState,
  updateProjectMemberInState,
} from "./teamProgress";
import { isSuperAdminAccount } from "./workspaceAccountRuntime";
import type {
  AppState,
  Project,
  ProjectMember,
  ProjectMemberRole,
  TaskStageMode,
} from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;

type AccessibleMemberInput = {
  accountId?: string;
  name: string;
  email?: string;
  workspaceId?: string;
  roles: ProjectMemberRole[];
};

export type AppProjectActionsRuntimeOptions = {
  updateState: UpdateState;
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
  updateState,
  setToast,
}: AppProjectActionsRuntimeOptions): AppProjectActionsRuntime {
  const createProject = (name: string, description: string, workspaceId?: string, taskStageMode: TaskStageMode = "regular") => {
    const projectName = name.trim();
    if (!projectName) {
      setToast("项目名称不能为空");
      return;
    }
    const timestamp = nowIso();
    updateState((value) =>
      createProjectInState(value, projectName, description, timestamp, uid, {
        accountId: value.auth.account?.id,
        name: value.auth.account?.name,
        email: value.auth.account?.email,
        workspaceId: workspaceId || value.auth.workspace?.id,
        taskStageMode,
      }),
    );
    setToast("项目已创建");
  };

  const updateProject = (project: Project) => {
    const timestamp = nowIso();
    updateState((value) => updateProjectInState(value, project, timestamp));
  };

  const reorderProjects = (projectIds: string[]) => {
    const timestamp = nowIso();
    updateState((value) => reorderProjectsInState(value, projectIds, timestamp));
  };

  const canManageProjectMembersForProject = (source: AppState, projectId: string) => {
    if (isSuperAdminAccount(source.auth.account)) return true;
    return canManageProjectMembers(source, projectId);
  };

  const bindAccessibleMemberToProject = (projectId: string, input: AccessibleMemberInput) => {
    const timestamp = nowIso();
    updateState((value) =>
      addProjectMemberToState(value, projectId, input.name, input.email ?? "", input.roles, timestamp, uid, {
        accountId: input.accountId,
        workspaceId: input.workspaceId,
      }),
    );
    setToast("项目成员绑定已更新");
  };

  const updateProjectMember = (member: ProjectMember) => {
    const timestamp = nowIso();
    updateState((value) => updateProjectMemberInState(value, member, timestamp));
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
