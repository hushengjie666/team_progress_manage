import { defaultTaskStageForMode } from "../../appModel";
import type { ProjectDetailModel } from "../../projectDetailModel";
import type { ProjectTaskInput } from "../../projectDetailTypes";
import type { Project, Task, TaskStageMode, TaskStatus, Workspace } from "../../types";

export type ProjectDetailTab = "overview" | "schedule" | "tasks" | "members" | "settings";

export type ProjectSettingsDraft = {
  projectId: string;
  name: string;
  description: string;
  taskStageMode: TaskStageMode;
  workspaceId: string;
};

export const createEmptyProjectTaskDraft = (taskStageMode: TaskStageMode = "software"): ProjectTaskInput => ({
  title: "",
  notes: "",
  tags: [],
  priority: "medium",
  severity: "medium",
  stage: defaultTaskStageForMode(taskStageMode),
  estimateHours: 1,
  collaboratorMemberIds: [],
  repeatRule: "none",
  repeatIntervalDays: 1,
  subtasks: [],
});

export const projectStageModeFor = (project: Project) => project.taskStageMode ?? "software";

export const currentProjectWorkspaceIdFor = (project: Project, workspace?: Workspace) =>
  project.workspaceId ?? workspace?.id;

export const projectWorkspaceTagLabel = (workspace?: Workspace) => {
  if (!workspace) return "未归属工作区";
  return `${(workspace.type ?? "shared") === "private" ? "私人工作区" : "协作工作区"} · ${workspace.name}`;
};

export const projectSettingsDraftForModel = (model: ProjectDetailModel): ProjectSettingsDraft => ({
  projectId: model.project.id,
  name: model.project.name,
  description: model.project.description,
  taskStageMode: model.project.taskStageMode ?? "software",
  workspaceId: model.project.workspaceId ?? model.workspace?.id ?? "",
});

export const editableProjectSettingsFor = (
  project: Project,
  workspace: Workspace | undefined,
  settingsDraft: ProjectSettingsDraft | null,
): ProjectSettingsDraft => {
  if (settingsDraft?.projectId === project.id) return settingsDraft;
  const projectStageMode = projectStageModeFor(project);
  const currentProjectWorkspaceId = currentProjectWorkspaceIdFor(project, workspace);
  return {
    projectId: project.id,
    name: project.name,
    description: project.description,
    taskStageMode: projectStageMode,
    workspaceId: currentProjectWorkspaceId ?? "",
  };
};

export const projectWorkspaceOptions = (
  availableWorkspaces: Workspace[],
  workspace: Workspace | undefined,
  currentProjectWorkspaceId?: string,
) => [
  ...availableWorkspaces,
  ...(workspace && !availableWorkspaces.some((item) => item.id === workspace.id) ? [workspace] : []),
].filter((item, index, items) =>
  items.findIndex((candidate) => candidate.id === item.id) === index &&
  ((item.type ?? "shared") !== "private" || item.id === currentProjectWorkspaceId),
);

export const canShowProjectMemberManagementFor = ({
  canManageProjectMembers,
  workspace,
}: {
  canManageProjectMembers: boolean;
  workspace?: Workspace;
}) => canManageProjectMembers && (workspace?.type ?? "shared") !== "private";

export const projectDetailActiveTabFor = (
  activeTab: ProjectDetailTab,
  canShowProjectMemberManagement: boolean,
) => !canShowProjectMemberManagement && activeTab === "members" ? "overview" : activeTab;

export const projectTaskStatusPatch = (
  status: TaskStatus,
  task: Task | undefined,
  currentProjectMemberId: string | undefined,
  timestamp: string,
): Partial<Task> => ({
  status,
  completedAt: status === "completed" ? timestamp : undefined,
  reviewSubmittedAt: status === "pending_review" ? timestamp : undefined,
  reviewSubmittedByMemberId: status === "pending_review" && task ? currentProjectMemberId : undefined,
});
