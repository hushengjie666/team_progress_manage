import type { WorkspaceType } from "../../types";
import type { WorkspaceEditFieldsProps } from "./workspaceEditFormTypes";

export function WorkspaceEditFields({
  selectedCard,
  selectedMembers,
  selectedWorkspaceType,
  selectedOwnerAccountId,
  editingOwnerAccountId,
  workspaceEditDraft,
  setWorkspaceEditDraft,
  workspaceEditWarning,
  setWorkspaceEditWarning,
  canEditSelectedWorkspace,
  canChangeSelectedWorkspaceType,
  canChangeSelectedWorkspaceOwner,
  startWorkspaceEdit,
}: WorkspaceEditFieldsProps) {
  const ensureDraftStarted = () => {
    if (!workspaceEditDraft.name) startWorkspaceEdit();
  };

  return (
    <div className="settings-grid">
      <label>
        工作区名称
        <input
          aria-invalid={Boolean(workspaceEditWarning.name)}
          disabled={!canEditSelectedWorkspace}
          value={workspaceEditDraft.name || selectedCard.workspace.name}
          onChange={(event) => {
            setWorkspaceEditDraft({ ...workspaceEditDraft, name: event.target.value, type: workspaceEditDraft.type ?? selectedWorkspaceType });
            if (workspaceEditWarning.name) setWorkspaceEditWarning({ ...workspaceEditWarning, name: undefined });
          }}
          onFocus={ensureDraftStarted}
        />
        {workspaceEditWarning.name && <span className="field-error">{workspaceEditWarning.name}</span>}
      </label>
      <label>
        工作区属性
        {selectedWorkspaceType === "private" ? (
          <input disabled value="私人工作区" readOnly />
        ) : (
          <select
            disabled={!canChangeSelectedWorkspaceType}
            value={workspaceEditDraft.type || selectedWorkspaceType}
            onFocus={ensureDraftStarted}
            onChange={(event) => {
              const nextType = event.target.value as WorkspaceType;
              setWorkspaceEditDraft({
                ...workspaceEditDraft,
                name: workspaceEditDraft.name || selectedCard.workspace.name,
                type: nextType,
                ownerAccountId: nextType === "private" ? selectedOwnerAccountId : editingOwnerAccountId,
              });
            }}
          >
            <option value="private" disabled={!canChangeSelectedWorkspaceType}>私人工作区</option>
            <option value="shared">协作工作区</option>
          </select>
        )}
      </label>
      <label>
        工作区负责人
        <select
          aria-invalid={Boolean(workspaceEditWarning.owner)}
          disabled={!canChangeSelectedWorkspaceOwner || (workspaceEditDraft.type || selectedWorkspaceType) === "private"}
          value={editingOwnerAccountId}
          onFocus={ensureDraftStarted}
          onChange={(event) => {
            setWorkspaceEditDraft({
              ...workspaceEditDraft,
              name: workspaceEditDraft.name || selectedCard.workspace.name,
              type: workspaceEditDraft.type || selectedWorkspaceType,
              ownerAccountId: event.target.value,
            });
            if (workspaceEditWarning.owner) setWorkspaceEditWarning({ ...workspaceEditWarning, owner: undefined });
          }}
        >
          {selectedMembers.map((member) => (
            <option key={member.accountId} value={member.accountId}>
              {member.name} · {member.email}
            </option>
          ))}
          {!selectedMembers.length && selectedOwnerAccountId && (
            <option value={selectedOwnerAccountId}>当前负责人</option>
          )}
        </select>
        {workspaceEditWarning.owner && <span className="field-error">{workspaceEditWarning.owner}</span>}
      </label>
    </div>
  );
}
