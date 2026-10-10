import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { ProjectTaskCreateClassificationSection } from "./taskCreate/ProjectTaskCreateClassificationSection";
import { ProjectTaskCreateCollaborationSection } from "./taskCreate/ProjectTaskCreateCollaborationSection";
import { ProjectTaskCreatePrimarySection } from "./taskCreate/ProjectTaskCreatePrimarySection";
import { ProjectTaskCreateScheduleSection } from "./taskCreate/ProjectTaskCreateScheduleSection";
import type { ProjectTaskCreateDialogProps } from "./taskCreate/taskCreateTypes";

export function ProjectTaskCreateDialog(props: ProjectTaskCreateDialogProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tagText, setTagText] = useState("");
  const canEditFields = props.canEdit && !props.busy && !props.fieldsDisabled;

  useEffect(() => {
    if (props.open) {
      setShowAdvanced(false);
      setTagText((props.draft.tags ?? []).join(", "));
    }
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel project-task-create-modal" role="dialog" aria-modal="true" aria-label={props.heading ?? "添加项目任务"}>
        <div className="section-title project-task-create-header">
          <div>
            <p className="eyebrow">Project Task</p>
            <h2>{props.heading ?? "添加任务"}</h2>
          </div>
          <button className="icon-button small" disabled={props.busy} onClick={props.onCancel} title="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="project-task-create-body">
          {props.error && <p className="warning-line compact" role="alert">{props.error}</p>}
          {props.projectField}
          <ProjectTaskCreatePrimarySection
            draft={props.draft}
            executors={props.executors}
            taskStageMode={props.taskStageMode}
            canEdit={canEditFields}
            setDraft={props.setDraft}
          />
          <button className="secondary-button project-task-advanced-toggle" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? "收起更多字段" : "展开更多字段"}
            <ChevronRight className={showAdvanced ? "rotate-90" : ""} size={16} />
          </button>
          {showAdvanced && (
            <div className="project-task-create-advanced">
              <ProjectTaskCreateClassificationSection
                draft={props.draft}
                tagText={tagText}
                canEdit={canEditFields}
                setDraft={props.setDraft}
                setTagText={setTagText}
              />
              <ProjectTaskCreateScheduleSection
                draft={props.draft}
                canEdit={canEditFields}
                setDraft={props.setDraft}
              />
              <ProjectTaskCreateCollaborationSection
                draft={props.draft}
                members={props.members}
                canEdit={canEditFields}
                setDraft={props.setDraft}
              />
            </div>
          )}
        </div>
        <div className="button-row modal-actions">
          <button className="secondary-button" disabled={props.busy} onClick={props.onCancel}>
            取消
          </button>
          <button className="primary-button" disabled={!props.canEdit || props.busy || !props.draft.title.trim()} onClick={props.onConfirm}>
            {props.busy ? "正在保存…" : props.confirmLabel ?? "创建任务"}
          </button>
        </div>
      </section>
    </div>
  );
}
