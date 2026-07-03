import { Plus } from "lucide-react";
import { taskStageModeOptions } from "../../appModel";
import type { TaskStageMode } from "../../types";
import type { ProjectDraft } from "./useWorkspaceProjectDrafts";

type WorkspaceProjectCreateFormProps = {
  projectDraft: ProjectDraft;
  setProjectDraft: (draft: ProjectDraft) => void;
  projectDraftWarning: string;
  setProjectDraftWarning: (warning: string) => void;
  submitProject: () => void;
};

export function WorkspaceProjectCreateForm({
  projectDraft,
  setProjectDraft,
  projectDraftWarning,
  setProjectDraftWarning,
  submitProject,
}: WorkspaceProjectCreateFormProps) {
  return (
    <div className="workspace-project-create">
      <label>
        项目名称
        <input
          value={projectDraft.name}
          aria-invalid={Boolean(projectDraftWarning)}
          onChange={(event) => {
            setProjectDraft({ ...projectDraft, name: event.target.value });
            if (projectDraftWarning) setProjectDraftWarning("");
          }}
          placeholder="例如：客户交付项目"
        />
        {projectDraftWarning && <span className="field-error">{projectDraftWarning}</span>}
      </label>
      <label>
        项目类型
        <select
          value={projectDraft.taskStageMode}
          onChange={(event) => setProjectDraft({ ...projectDraft, taskStageMode: event.target.value as TaskStageMode })}
        >
          {taskStageModeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        项目说明
        <input
          value={projectDraft.description}
          onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })}
          placeholder="这个项目要达成什么"
        />
      </label>
      <button className="primary-button" onClick={submitProject} type="button">
        <Plus size={16} />
        添加项目
      </button>
    </div>
  );
}
