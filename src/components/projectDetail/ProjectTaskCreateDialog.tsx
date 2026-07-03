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

  useEffect(() => {
    if (props.open) {
      setShowAdvanced(false);
      setTagText((props.draft.tags ?? []).join(", "));
    }
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel project-task-create-modal" role="dialog" aria-modal="true" aria-label="添加项目任务">
        <div className="section-title project-task-create-header">
          <div>
            <p className="eyebrow">Project Task</p>
            <h2>添加任务</h2>
          </div>
          <button className="icon-button small" onClick={props.onCancel} title="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="project-task-create-body">
          <ProjectTaskCreatePrimarySection
            draft={props.draft}
            executors={props.executors}
            taskStageMode={props.taskStageMode}
            canEdit={props.canEdit}
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
                canEdit={props.canEdit}
                setDraft={props.setDraft}
                setTagText={setTagText}
              />
              <ProjectTaskCreateScheduleSection
                draft={props.draft}
                canEdit={props.canEdit}
                setDraft={props.setDraft}
              />
              <ProjectTaskCreateCollaborationSection
                draft={props.draft}
                members={props.members}
                canEdit={props.canEdit}
                setDraft={props.setDraft}
              />
            </div>
          )}
        </div>
        <div className="button-row modal-actions">
          <button className="secondary-button" onClick={props.onCancel}>
            取消
          </button>
          <button className="primary-button" disabled={!props.canEdit || !props.draft.title.trim()} onClick={props.onConfirm}>
            创建任务
          </button>
        </div>
      </section>
    </div>
  );
}
