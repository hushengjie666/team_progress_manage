import type { ProjectTaskInput } from "../../../projectDetail";
import type { ProjectMember, TaskStageMode } from "../../../types";

export type ProjectTaskCreateDialogProps = {
  open: boolean;
  draft: ProjectTaskInput;
  members: ProjectMember[];
  executors: ProjectMember[];
  taskStageMode: TaskStageMode;
  canEdit: boolean;
  setDraft: (draft: ProjectTaskInput) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export type ProjectTaskCreateSectionProps = {
  draft: ProjectTaskInput;
  canEdit: boolean;
  setDraft: (draft: ProjectTaskInput) => void;
};
