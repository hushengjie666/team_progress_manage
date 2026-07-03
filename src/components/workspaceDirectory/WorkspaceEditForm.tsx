import { Save } from "lucide-react";
import { WorkspaceEditFields } from "./WorkspaceEditFields";
import type { WorkspaceEditFormProps } from "./workspaceEditFormTypes";

export function WorkspaceEditForm({
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
  saveWorkspaceEdit,
}: WorkspaceEditFormProps) {
  return (
    <section className="workspace-edit-form">
      <div className="member-section-title">
        <strong>工作区资料</strong>
        <span>
          {!canEditSelectedWorkspace
            ? "当前账号没有工作区编辑权限"
            : selectedWorkspaceType === "private"
              ? "可维护名称；私人工作区属性不可变更，创建人仅展示"
              : canChangeSelectedWorkspaceType
                ? "可维护名称和属性；创建人仅展示"
                : "可维护名称；属性需工作区负责人维护，创建人仅展示"}
        </span>
      </div>
      <WorkspaceEditFields
        selectedCard={selectedCard}
        selectedMembers={selectedMembers}
        selectedWorkspaceType={selectedWorkspaceType}
        selectedOwnerAccountId={selectedOwnerAccountId}
        workspaceEditDraft={workspaceEditDraft}
        setWorkspaceEditDraft={setWorkspaceEditDraft}
        workspaceEditWarning={workspaceEditWarning}
        setWorkspaceEditWarning={setWorkspaceEditWarning}
        canEditSelectedWorkspace={canEditSelectedWorkspace}
        canChangeSelectedWorkspaceType={canChangeSelectedWorkspaceType}
        startWorkspaceEdit={startWorkspaceEdit}
      />
      {(workspaceEditDraft.type || selectedWorkspaceType) === "private" && selectedWorkspaceType === "shared" && (
        <p className="warning-line">保存为私人工作区后，仅创建人保留访问权限，待处理邀请会自动取消。</p>
      )}
      <div className="button-row workspace-edit-actions">
        <button className="primary-button" disabled={!canEditSelectedWorkspace} onClick={() => void saveWorkspaceEdit()} type="button">
          <Save size={16} />
          保存工作区
        </button>
      </div>
    </section>
  );
}
