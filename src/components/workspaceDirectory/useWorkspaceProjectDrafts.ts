import { useState } from "react";
import type { Project, TaskStageMode } from "../../types";
import type { ProjectEditDraft, WorkspaceDirectoryCard } from "./workspaceDirectoryModel";

export type ProjectDraft = {
  name: string;
  description: string;
  taskStageMode: TaskStageMode;
};

const emptyProjectDraft = (): ProjectDraft => ({
  name: "",
  description: "",
  taskStageMode: "regular",
});

const projectEditDraftFrom = (project: Project): ProjectEditDraft => ({
  name: project.name,
  description: project.description,
  taskStageMode: project.taskStageMode ?? "software",
});

export function useWorkspaceProjectDrafts({
  selectedCard,
  createProject,
  updateProject,
}: {
  selectedCard?: WorkspaceDirectoryCard;
  createProject: (name: string, description: string, workspaceId?: string, taskStageMode?: TaskStageMode) => void;
  updateProject: (project: Project) => void;
}) {
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [projectDraftWarning, setProjectDraftWarning] = useState("");
  const [projectEditDrafts, setProjectEditDrafts] = useState<Record<string, ProjectEditDraft>>({});
  const [projectEditWarnings, setProjectEditWarnings] = useState<Record<string, string>>({});

  const projectEditDraftFor = (project: Project): ProjectEditDraft => projectEditDrafts[project.id] ?? projectEditDraftFrom(project);

  const updateProjectEditDraft = (project: Project, patch: Partial<ProjectEditDraft>) => {
    setProjectEditDrafts((current) => ({
      ...current,
      [project.id]: { ...(current[project.id] ?? projectEditDraftFrom(project)), ...patch },
    }));
    if (projectEditWarnings[project.id]) {
      setProjectEditWarnings((current) => ({ ...current, [project.id]: "" }));
    }
  };

  const submitProject = () => {
    if (!selectedCard) return;
    const name = projectDraft.name.trim();
    if (!name) {
      setProjectDraftWarning("项目名称不能为空");
      return;
    }
    createProject(name, projectDraft.description, selectedCard.workspace.id, projectDraft.taskStageMode);
    setProjectDraft(emptyProjectDraft());
    setProjectDraftWarning("");
  };

  const saveProjectEdit = (project: Project) => {
    const draft = projectEditDraftFor(project);
    const name = draft.name.trim();
    if (!name) {
      setProjectEditWarnings((current) => ({ ...current, [project.id]: "项目名称不能为空" }));
      return;
    }
    updateProject({
      ...project,
      name,
      description: draft.description,
      taskStageMode: draft.taskStageMode,
    });
    setProjectEditDrafts((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });
    setProjectEditWarnings((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });
  };

  const resetProjectEditState = () => {
    setProjectEditDrafts({});
    setProjectEditWarnings({});
  };

  return {
    projectDraft,
    setProjectDraft,
    projectDraftWarning,
    setProjectDraftWarning,
    submitProject,
    projectEditDraftFor,
    updateProjectEditDraft,
    projectEditWarnings,
    saveProjectEdit,
    resetProjectEditState,
  };
}
