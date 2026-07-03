import { useState } from "react";
import type { ProjectTaskInput } from "../../projectDetail";
import type { Project, TaskStageMode } from "../../types";
import { createEmptyProjectTaskDraft } from "./projectDetailControllerModel";

export function useProjectDetailTaskCreation({
  project,
  projectStageMode,
  canEditTasks,
  createProjectTask,
}: {
  project?: Project;
  projectStageMode: TaskStageMode;
  canEditTasks: boolean;
  createProjectTask: (projectId: string, input: ProjectTaskInput) => void;
}) {
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [draft, setDraft] = useState<ProjectTaskInput>(() => createEmptyProjectTaskDraft());

  const createTask = () => {
    if (!project || !canEditTasks || !draft.title.trim()) return;
    createProjectTask(project.id, draft);
    setDraft(createEmptyProjectTaskDraft(projectStageMode));
    setShowCreateTaskDialog(false);
  };

  const openCreateTaskDialog = () => {
    setDraft(createEmptyProjectTaskDraft(projectStageMode));
    setShowCreateTaskDialog(true);
  };

  return {
    showCreateTaskDialog,
    draft,
    setDraft,
    createTask,
    openCreateTaskDialog,
    closeCreateTaskDialog: () => setShowCreateTaskDialog(false),
  };
}
