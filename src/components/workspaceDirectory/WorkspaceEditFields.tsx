import type { WorkspaceType } from "../../types";
import type { WorkspaceEditFieldsProps } from "./workspaceEditFormTypes";

export function WorkspaceEditFields({
  selectedCard,
  selectedMembers,
  selectedWorkspaceType,
  selectedOwnerAccountId,
  workspaceEditDraft,
  setWorkspaceEditDraft,
  workspaceEditWarning,
  setWorkspaceEditWarning,
  canEditSelectedWorkspace,
  canChangeSelectedWorkspaceType,
  startWorkspaceEdit,
}: WorkspaceEditFieldsProps) {
  const ensureDraftStarted = () => {
    if (!workspaceEditDraft.name) startWorkspaceEdit();
  };
  const creator = selectedMembers.find((member) => member.accountId === selectedOwnerAccountId);
  const creatorLabel = creator
    ? `${creator.name} · ${creator.email}`
    : selectedOwnerAccountId
      ? `账号 ${selectedOwnerAccountId}`
      : "未记录创建人";

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
                ownerAccountId: selectedOwnerAccountId,
              });
            }}
          >
            <option value="private" disabled={!canChangeSelectedWorkspaceType}>私人工作区</option>
            <option value="shared">协作工作区</option>
          </select>
        )}
      </label>
      <label>
        创建人
        <input disabled value={creatorLabel} readOnly />
        {workspaceEditWarning.owner && <span className="field-error">{workspaceEditWarning.owner}</span>}
      </label>
    </div>
  );
}
