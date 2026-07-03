import { resolveMemberIdForProject, sameMemberIdentity } from "./memberIdentity";
import type { AppState, Project, ProjectMember, Task } from "./types";
import { demoEntityIdForProject, demoTaskIdForProject } from "./demoDataMergeUtils";
import {
  fallbackDemoTaskNotes,
  fallbackDemoTaskProgressNote,
  normalizeDemoTaskStage,
  targetProjectDemoTaskPatch,
} from "./demoDataTaskContent";

const preferredDemoExecutorForProject = (state: AppState, projectId: string, preferredMemberId?: string): ProjectMember | undefined => {
  const projectExecutors = state.projectMembers.filter(
    (member) => member.projectId === projectId && member.status !== "disabled" && member.roles.includes("executor"),
  );
  const preferredMember = preferredMemberId
    ? state.projectMembers.find((member) => member.id === preferredMemberId && member.status !== "disabled")
    : undefined;
  const accountId = state.auth.account?.id;
  return (
    projectExecutors.find((member) => preferredMember && member.id === preferredMember.id) ??
    projectExecutors.find((member) => preferredMember && sameMemberIdentity(member, preferredMember)) ??
    projectExecutors.find((member) => accountId && member.accountId === accountId) ??
    projectExecutors[0]
  );
};

export const cloneDemoTasksForProject = ({
  current,
  demoTasks,
  targetProject,
  workspaceId,
  timestamp,
}: {
  current: AppState;
  demoTasks: Task[];
  targetProject: Project;
  workspaceId?: string;
  timestamp: string;
}): Task[] => {
  const projectId = targetProject.id;
  const taskStageMode = targetProject.taskStageMode ?? "software";
  const actorMemberId = resolveMemberIdForProject(current, projectId);
  const targetExecutor = preferredDemoExecutorForProject(current, projectId, actorMemberId);
  const targetExecutorMemberId = targetExecutor?.id ?? actorMemberId;

  return demoTasks.map((task) => {
    const taskPatch = targetProjectDemoTaskPatch(task, targetProject.name);
    const patchedTask = { ...task, ...taskPatch };
    return {
      ...patchedTask,
      id: demoTaskIdForProject(task.id, projectId),
      workspaceId,
      projectId,
      project: targetProject.name,
      creatorMemberId: actorMemberId ?? targetExecutorMemberId,
      primaryExecutorMemberId: targetExecutorMemberId,
      collaboratorMemberIds: [],
      notes: patchedTask.notes.trim() || fallbackDemoTaskNotes(patchedTask, targetProject.name),
      tags: patchedTask.tags.length ? patchedTask.tags : ["演示", "任务"],
      stage: normalizeDemoTaskStage(patchedTask.stage, taskStageMode),
      progressNote: (patchedTask.progressNote ?? "").trim() || fallbackDemoTaskProgressNote(patchedTask),
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, id: demoEntityIdForProject(subtask.id, projectId) })),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
};
