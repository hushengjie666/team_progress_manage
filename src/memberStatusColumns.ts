import { today } from "./appModel";
import {
  accessibleProjectIdsForCurrentUser,
  activeWorkspaceIdsForCurrentAccount,
  workspaceForProject,
  workspaceIdForProject,
  workspaceMembershipsForState,
} from "./accessControl";
import { buildMemberStatusPeople } from "./memberStatusPeople";
import {
  groupMemberTasksByProject,
  sortMemberStatusTasks,
  taskBelongsToMemberStatusPerson,
} from "./memberStatusTasks";
import type { MemberStatusColumn } from "./memberStatusTypes";
import type { AppState } from "./types";

const sourceProjectIdsForMemberStatus = (state: AppState, projectId?: string) => {
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state);
  return projectId
    ? new Set(accessibleProjectIds.has(projectId) ? [projectId] : [])
    : accessibleProjectIds;
};

const sourceTasksForMemberStatus = (state: AppState, sourceProjectIds: Set<string>) =>
  state.tasks.filter((task) =>
    task.status !== "split" &&
    task.status !== "archived" &&
    sourceProjectIds.has(task.projectId),
  );

const todayTaskIdsForMemberStatus = (state: AppState, sourceTaskIds: Set<string>, date: string) =>
  new Set(
    state.dailyPlans
      .filter((plan) => plan.date === date)
      .flatMap((plan) => plan.committedTaskIds)
      .filter((taskId) => sourceTaskIds.has(taskId)),
  );

export const countMemberStatusTodayTasks = (state: AppState, projectId?: string, date = today()) => {
  const sourceProjectIds = sourceProjectIdsForMemberStatus(state, projectId);
  const sourceTaskIds = new Set(sourceTasksForMemberStatus(state, sourceProjectIds).map((task) => task.id));
  return todayTaskIdsForMemberStatus(state, sourceTaskIds, date).size;
};

export const buildMemberStatusColumns = (state: AppState, projectId?: string, date = today()): MemberStatusColumn[] => {
  const sourceProjectIds = sourceProjectIdsForMemberStatus(state, projectId);
  const accessibleWorkspaceIds = activeWorkspaceIdsForCurrentAccount(state);
  const sourceWorkspaceIds = new Set(
    state.projects
      .filter((project) => sourceProjectIds.has(project.id))
      .map((project) => workspaceIdForProject(state, project))
      .filter((workspaceId): workspaceId is string => typeof workspaceId === "string" && accessibleWorkspaceIds.has(workspaceId)),
  );
  const sourceProjectMembers = state.projectMembers.filter((member) => sourceProjectIds.has(member.projectId) && member.status !== "disabled");
  const sourceWorkspaceMemberships = workspaceMembershipsForState(state).filter(
    (membership) => sourceWorkspaceIds.has(membership.workspaceId) && membership.status === "active",
  );
  const members = buildMemberStatusPeople(sourceProjectMembers, sourceWorkspaceMemberships);
  const sourceTasks = sourceTasksForMemberStatus(state, sourceProjectIds);
  const sourceTaskIds = new Set(sourceTasks.map((task) => task.id));
  const todayTaskIdSet = todayTaskIdsForMemberStatus(state, sourceTaskIds, date);
  const activeSessions = state.workSessions
    .filter((session) => session.status === "active" && sourceTasks.some((task) => task.id === session.taskId))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const projectNameById = new Map(state.projects.map((project) => [project.id, project.name]));
  const workspaceNameByProjectId = new Map(
    state.projects.flatMap((project): [string, string][] => {
      const workspaceName = workspaceForProject(state, project)?.name;
      return workspaceName ? [[project.id, workspaceName]] : [];
    }),
  );

  return members.map((member) => {
    const memberIdSet = new Set(member.memberIds);
    const runningSession = activeSessions.find((session) => session.executorMemberId && memberIdSet.has(session.executorMemberId));
    const runningTask = runningSession ? sourceTasks.find((task) => task.id === runningSession.taskId) : undefined;
    const memberTodayTasks = sortMemberStatusTasks(
      sourceTasks.filter((task) =>
        (todayTaskIdSet.has(task.id) || task.id === runningTask?.id) &&
        taskBelongsToMemberStatusPerson(task, member, memberIdSet),
      ),
      runningTask,
    );
    const displayedTasks = runningTask && !memberTodayTasks.some((task) => task.id === runningTask.id)
      ? [runningTask, ...memberTodayTasks]
      : memberTodayTasks;
    const projectTaskGroups = groupMemberTasksByProject(member, displayedTasks, projectNameById, workspaceNameByProjectId)
      .filter((group) => group.tasks.length > 0);

    return {
      ...member,
      displayedTasks,
      projectTaskGroups,
      runningTask,
    };
  });
};
