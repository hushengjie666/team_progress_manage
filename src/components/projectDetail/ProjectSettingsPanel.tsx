import { Save } from "lucide-react";
import { taskStageModeOptions } from "../../appModel";
import type { TaskStageMode, Workspace } from "../../types";
import type { ProjectSettingsDraft } from "./projectDetailControllerModel";

export function ProjectSettingsPanel({
  settings,
  workspaceOptions,
  canEdit,
  updateSettings,
  saveSettings,
}: {
  settings: ProjectSettingsDraft;
  workspaceOptions: Workspace[];
  canEdit: boolean;
  updateSettings: (patch: Partial<Omit<ProjectSettingsDraft, "projectId">>) => void;
  saveSettings: () => void;
}) {
  return (
    <section className="band project-settings-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">项目设置</p>
          <h2>项目资料</h2>
        </div>
      </div>
      <div className="settings-grid project-settings-form">
        <label>
          项目名称
          <input value={settings.name} disabled={!canEdit} onChange={(event) => updateSettings({ name: event.target.value })} />
        </label>
        <label>
          项目类型
          <select
            value={settings.taskStageMode}
            disabled={!canEdit}
            onChange={(event) => updateSettings({ taskStageMode: event.target.value as TaskStageMode })}
          >
            {taskStageModeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          所属工作区
          <select
            value={settings.workspaceId}
            disabled={!canEdit || workspaceOptions.length <= 1}
            onChange={(event) => updateSettings({ workspaceId: event.target.value })}
          >
            {workspaceOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {(item.type ?? "shared") === "private" ? "私人" : "协作"} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="project-settings-description">
          项目说明
          <textarea value={settings.description} disabled={!canEdit} onChange={(event) => updateSettings({ description: event.target.value })} />
        </label>
      </div>
      <div className="project-settings-actions">
        <button className="primary-button" disabled={!canEdit || !settings.name.trim()} onClick={saveSettings}>
          <Save size={16} />
          保存项目资料
        </button>
      </div>
    </section>
  );
}
