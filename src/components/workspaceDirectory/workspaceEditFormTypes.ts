import type { Dispatch, SetStateAction } from "react";
import type { WorkspaceMembership, WorkspaceType, WorkspaceUpdateInput } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";
import type { WorkspaceEditWarning } from "./workspaceDirectoryModalModel";

export type { WorkspaceEditWarning } from "./workspaceDirectoryModalModel";

export type WorkspaceEditFormProps = {
  selectedCard: WorkspaceDirectoryCard;
  selectedMembers: WorkspaceMembership[];
  selectedWorkspaceType: WorkspaceType;
  selectedOwnerAccountId: string;
  workspaceEditDraft: WorkspaceUpdateInput;
  setWorkspaceEditDraft: Dispatch<SetStateAction<WorkspaceUpdateInput>>;
  workspaceEditWarning: WorkspaceEditWarning;
  setWorkspaceEditWarning: Dispatch<SetStateAction<WorkspaceEditWarning>>;
  canEditSelectedWorkspace: boolean;
  canChangeSelectedWorkspaceType: boolean;
  startWorkspaceEdit: () => void;
  saveWorkspaceEdit: () => Promise<void>;
};

export type WorkspaceEditFieldsProps = Omit<WorkspaceEditFormProps, "saveWorkspaceEdit">;
