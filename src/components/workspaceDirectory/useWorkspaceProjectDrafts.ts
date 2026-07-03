import { useState } from "react";
import type { TaskStageMode } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";

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

export function useWorkspaceProjectDrafts({
  selectedCard,
  createProject,
}: {
  selectedCard?: WorkspaceDirectoryCard;
  createProject: (name: string, description: string, workspaceId?: string, taskStageMode?: TaskStageMode) => void;
}) {
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [projectDraftWarning, setProjectDraftWarning] = useState("");

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

  return {
    projectDraft,
    setProjectDraft,
    projectDraftWarning,
    setProjectDraftWarning,
    submitProject,
  };
}
