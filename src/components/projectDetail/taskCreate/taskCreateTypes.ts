import type { ReactNode } from "react";
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
  heading?: string;
  confirmLabel?: string;
  projectField?: ReactNode;
  busy?: boolean;
  error?: string;
  fieldsDisabled?: boolean;
};

export type ProjectTaskCreateSectionProps = {
  draft: ProjectTaskInput;
  canEdit: boolean;
  setDraft: (draft: ProjectTaskInput) => void;
};
