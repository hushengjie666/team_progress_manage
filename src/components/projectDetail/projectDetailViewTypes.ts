import type {
  ProjectDetailModel,
  ProjectTaskFilters,
  ProjectTaskInput,
} from "../../projectDetail";
import type { Project, ProjectMember, ProjectMemberRole, Task, Workspace } from "../../types";
import type { ProjectDetailTab } from "./projectDetailControllerModel";

export type ProjectDetailViewProps = {
  model?: ProjectDetailModel;
  filters: ProjectTaskFilters;
  setFilters: (filters: ProjectTaskFilters) => void;
  allProjects: Project[];
  allProjectMembers: ProjectMember[];
  availableWorkspaces: Workspace[];
  currentProjectMemberId?: string;
  activeTab: ProjectDetailTab;
  setActiveTab: (tab: ProjectDetailTab) => void;
  selectedTask?: Task;
  selectTask: (taskId: string | null) => void;
  createProjectTask: (projectId: string, input: ProjectTaskInput) => void;
  updateProject: (project: Project) => void;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: {
    projectId?: string;
    primaryExecutorMemberId?: string;
    collaboratorMemberIds?: string[];
  }) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
  splitTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  bindAccessibleMemberToProject: (projectId: string, input: {
    accountId?: string;
    name: string;
    email?: string;
    workspaceId?: string;
    roles: ProjectMemberRole[];
  }) => void;
  inviteProjectMember: (input: {
    workspaceId?: string;
    projectId: string;
    email: string;
    roles: ProjectMemberRole[];
  }) => void;
  updateProjectMember: (member: ProjectMember) => void;
  canManageProjectMembers?: boolean;
  backToBoard: () => void;
  backToAdmin: () => void;
  openMemberSettings: () => void;
};

export type { ProjectDetailTab } from "./projectDetailControllerModel";
