import { useState } from "react";
import { nowIso } from "../../appModel";
import type { ProjectMemberRole, TaskStatus } from "../../types";
import { updateProjectMemberRole, type ProjectDetailMemberRoleTarget } from "./projectDetailMemberRoleActions";
import {
  canShowProjectMemberManagementFor,
  projectDetailActiveTabFor,
  projectStageModeFor,
  projectTaskStatusPatch,
  projectWorkspaceTagLabel,
} from "./projectDetailControllerModel";
import type { ProjectDetailViewProps } from "./projectDetailViewTypes";
import { useProjectDetailSettingsController } from "./useProjectDetailSettingsController";
import { useProjectDetailTaskCreation } from "./useProjectDetailTaskCreation";

export type { ProjectDetailTab } from "./projectDetailControllerModel";
export type { ProjectDetailViewProps } from "./projectDetailViewTypes";

export function useProjectDetailController(props: ProjectDetailViewProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const { filters, setFilters } = props;
  const model = props.model;
  const projectStageMode = model ? projectStageModeFor(model.project) : "software";
  const taskCreation = useProjectDetailTaskCreation({
    project: model?.project,
    projectStageMode,
    canEditTasks: model?.access.canEditTasks ?? false,
    createProjectTask: props.createProjectTask,
  });
  const projectSettings = useProjectDetailSettingsController({
    model,
    availableWorkspaces: props.availableWorkspaces,
    canReviewTasks: model?.access.canReviewTasks ?? false,
    updateProject: props.updateProject,
  });

  if (!model) {
    return { hasModel: false } as const;
  }

  const {
    project,
    workspace,
    access,
    projectMembers,
    accessibleProjectMembers,
    executors,
    allProjectTasks,
    overviewTasks,
    acceptedTasks,
    todayPlan,
    activeProjectTaskIds,
    filteredTasks,
    board,
    riskSections,
    riskTaskCount,
    taskCounts,
    accessibleMemberCount,
    memberOverviewStats,
  } = model;
  const workspaceTagLabel = projectWorkspaceTagLabel(workspace);
  const editableProjectSettings = projectSettings.editableProjectSettings!;
  const workspaceOptions = projectSettings.workspaceOptions;
  const isPrivateProject = (workspace?.type ?? "shared") === "private";
  const canManageProjectMembers = !isPrivateProject && (props.canManageProjectMembers ?? access.canReviewTasks);
  const canShowProjectMemberManagement = canShowProjectMemberManagementFor({ workspace });
  const activeTab = projectDetailActiveTabFor(props.activeTab, canShowProjectMemberManagement);

  const updateStatus = (taskId: string, status: TaskStatus) => {
    const task = allProjectTasks.find((item) => item.id === taskId);
    props.updateTask(taskId, projectTaskStatusPatch(status, task, props.currentProjectMemberId, nowIso()));
  };

  const updateMemberRole = (member: ProjectDetailMemberRoleTarget, role: ProjectMemberRole, checked: boolean) => {
    updateProjectMemberRole({
      member,
      role,
      checked,
      project,
      workspace,
      bindAccessibleMemberToProject: props.bindAccessibleMemberToProject,
      updateProjectMember: props.updateProjectMember,
    });
  };

  return {
    hasModel: true,
    model,
    project,
    workspaceTagLabel,
    isPrivateProject,
    projectStageMode,
    activeTab,
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    showCreateTaskDialog: taskCreation.showCreateTaskDialog,
    showAddMemberDialog,
    setShowAddMemberDialog,
    draft: taskCreation.draft,
    setDraft: taskCreation.setDraft,
    editableProjectSettings,
    workspaceOptions,
    canManageProjectMembers,
    canShowProjectMemberManagement,
    projectMembers,
    accessibleProjectMembers,
    executors,
    allProjectTasks,
    overviewTasks,
    acceptedTasks,
    todayPlan,
    activeProjectTaskIds,
    filteredTasks,
    board,
    riskSections,
    riskTaskCount,
    taskCounts,
    access,
    accessibleMemberCount,
    memberOverviewStats,
    createTask: taskCreation.createTask,
    openCreateTaskDialog: taskCreation.openCreateTaskDialog,
    updateStatus,
    updateMemberRole,
    updateSettingsDraft: projectSettings.updateSettingsDraft,
    saveProjectSettings: projectSettings.saveProjectSettings,
    closeCreateTaskDialog: taskCreation.closeCreateTaskDialog,
    openAddMemberDialog: () => setShowAddMemberDialog(true),
    closeAddMemberDialog: () => setShowAddMemberDialog(false),
  } as const;
}
