import { useRef, useState } from "react";
import { defaultTaskStageForMode } from "../../appModel";
import { resolveMemberIdForProject } from "../../memberIdentity";
import type { AppTaskActionsRuntime } from "../../appTaskActionsTypes";
import type { AppState, Project } from "../../types";
import type { ProjectTaskInput } from "../../projectDetail";
import { ProjectTaskCreateDialog } from "../projectDetail/ProjectTaskCreateDialog";
import { createEmptyProjectTaskDraft } from "../projectDetail/projectDetailControllerModel";

export type FocusQuickTaskRecovery = {
  taskId: string;
  projectId: string;
  draft: ProjectTaskInput;
};

export function FocusQuickTaskDialog({ state, projects, defaultProjectId, taskActions, recovery, onClose, onQueueFailure }: {
  state: AppState;
  projects: Project[];
  defaultProjectId?: string;
  taskActions: Pick<AppTaskActionsRuntime, "createProjectTask" | "commitTask">;
  recovery?: FocusQuickTaskRecovery;
  onClose: () => void;
  onQueueFailure: (recovery: FocusQuickTaskRecovery) => void;
}) {
  const initialProject = projects.find((project) => project.id === (recovery?.projectId ?? defaultProjectId)) ?? projects[0];
  const [projectId, setProjectId] = useState(initialProject?.id ?? "");
  const [draft, setDraft] = useState<ProjectTaskInput>(() => recovery?.draft ?? ({
    ...createEmptyProjectTaskDraft(initialProject?.taskStageMode),
    primaryExecutorMemberId: initialProject ? resolveMemberIdForProject(state, initialProject.id) : undefined,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(recovery ? "任务已创建，但未加入今日队列。点击重试即可继续，不会重复创建任务。" : "");
  const [createdTaskId, setCreatedTaskId] = useState<string | undefined>(recovery?.taskId);
  const submittingRef = useRef(false);
  const selectedProject = projects.find((project) => project.id === projectId);
  const members = state.projectMembers.filter((member) => member.projectId === projectId && member.status !== "disabled");

  const changeProject = (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    setProjectId(id);
    setDraft((current) => ({
      ...current,
      stage: defaultTaskStageForMode(project.taskStageMode ?? "software"),
      primaryExecutorMemberId: resolveMemberIdForProject(state, id),
      collaboratorMemberIds: [],
    }));
    setError("");
  };

  const submit = async () => {
    if (submittingRef.current || !selectedProject || !draft.title.trim()) return;
    submittingRef.current = true;
    setBusy(true);
    setError("");
    let taskId = createdTaskId;
    try {
      if (!taskId) {
        const task = await taskActions.createProjectTask(projectId, draft, { notify: false });
        if (!task) {
          setError("任务保存失败，请重试。已填写的内容已保留。");
          return;
        }
        taskId = task.id;
        setCreatedTaskId(taskId);
      }
      const savingQueue = taskActions.commitTask(taskId);
      onClose();
      const queued = await savingQueue;
      if (!queued) {
        onQueueFailure({ taskId, projectId, draft });
        return;
      }
    } catch {
      if (taskId) onQueueFailure({ taskId, projectId, draft });
      else setError("任务保存失败，请重试。已填写的内容已保留。");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <ProjectTaskCreateDialog
      open
      heading="新增今日任务"
      confirmLabel={createdTaskId ? "重试加入今日" : "创建并加入今日"}
      draft={draft}
      setDraft={setDraft}
      members={members}
      executors={members.filter((member) => member.roles.includes("executor") || member.id === draft.primaryExecutorMemberId)}
      taskStageMode={selectedProject?.taskStageMode ?? "software"}
      canEdit={Boolean(selectedProject)}
      fieldsDisabled={Boolean(createdTaskId)}
      busy={busy}
      error={error}
      onCancel={onClose}
      onConfirm={() => void submit()}
      projectField={(
        <label>
          所属项目
          <select value={projectId} disabled={busy || Boolean(createdTaskId)} onChange={(event) => changeProject(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {state.auth.workspaces?.find((workspace) => workspace.id === project.workspaceId)?.name ?? "未归属工作区"}
              </option>
            ))}
          </select>
        </label>
      )}
    />
  );
}
