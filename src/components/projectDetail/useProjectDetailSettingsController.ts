import { useEffect, useState } from "react";
import type { ProjectDetailModel } from "../../projectDetail";
import type { Project, Workspace } from "../../types";
import {
  currentProjectWorkspaceIdFor,
  editableProjectSettingsFor,
  projectSettingsDraftForModel,
  projectWorkspaceOptions,
  type ProjectSettingsDraft,
} from "./projectDetailControllerModel";

type ProjectSettingsDraftPatch = Partial<Omit<ProjectSettingsDraft, "projectId">>;

type ProjectDetailSettingsController = {
  editableProjectSettings: ProjectSettingsDraft | null;
  workspaceOptions: Workspace[];
  updateSettingsDraft: (patch: ProjectSettingsDraftPatch) => void;
  saveProjectSettings: () => void;
};

export function useProjectDetailSettingsController({
  model,
  availableWorkspaces,
  canReviewTasks,
  updateProject,
}: {
  model?: ProjectDetailModel;
  availableWorkspaces: Workspace[];
  canReviewTasks: boolean;
  updateProject: (project: Project) => void;
}): ProjectDetailSettingsController {
  const [settingsDraft, setSettingsDraft] = useState<ProjectSettingsDraft | null>(null);

  useEffect(() => {
    if (!model) return;
    setSettingsDraft(projectSettingsDraftForModel(model));
  }, [model?.project.id, model?.project.updatedAt, model?.workspace?.id]);

  if (!model) {
    return {
      editableProjectSettings: null,
      workspaceOptions: [],
      updateSettingsDraft: () => {},
      saveProjectSettings: () => {},
    };
  }

  const { project, workspace } = model;
  const currentProjectWorkspaceId = currentProjectWorkspaceIdFor(project, workspace);
  const editableProjectSettings = editableProjectSettingsFor(project, workspace, settingsDraft);
  const workspaceOptions = projectWorkspaceOptions(availableWorkspaces, workspace, currentProjectWorkspaceId);

  const updateSettingsDraft = (patch: ProjectSettingsDraftPatch) => {
    setSettingsDraft((value) => ({
      ...(value?.projectId === project.id ? value : editableProjectSettings),
      ...patch,
    }));
  };

  const saveProjectSettings = () => {
    if (!canReviewTasks) return;
    const nextName = editableProjectSettings.name.trim();
    if (!nextName) return;
    const nextWorkspaceId = editableProjectSettings.workspaceId || currentProjectWorkspaceId;
    if (nextWorkspaceId && nextWorkspaceId !== currentProjectWorkspaceId) {
      const targetWorkspace = workspaceOptions.find((item) => item.id === nextWorkspaceId);
      const confirmed = window.confirm(`确定将项目「${project.name}」移动到「${targetWorkspace?.name ?? "目标工作区"}」吗？项目下的任务和项目成员归属会一起更新。`);
      if (!confirmed) return;
    }
    updateProject({
      ...project,
      name: nextName,
      description: editableProjectSettings.description,
      taskStageMode: editableProjectSettings.taskStageMode,
      workspaceId: nextWorkspaceId,
    });
  };

  return {
    editableProjectSettings,
    workspaceOptions,
    updateSettingsDraft,
    saveProjectSettings,
  };
}
