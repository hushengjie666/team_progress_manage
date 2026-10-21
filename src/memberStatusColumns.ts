import { today } from "./appModel";
import { todayKey } from "./seed";
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
import type { AppState, WorkSession } from "./types";

const sourceProjectIdsForMemberStatus = (state: AppState, projectId?: string, workspaceId?: string) => {
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state);
  const projectIds = projectId
    ? new Set(accessibleProjectIds.has(projectId) ? [projectId] : [])
    : accessibleProjectIds;
  if (!workspaceId) return projectIds;
  return new Set(
    state.projects
      .filter((project) => projectIds.has(project.id) && workspaceIdForProject(state, project) === workspaceId)
      .map((project) => project.id),
  );
};

const sourceTasksForMemberStatus = (state: AppState, sourceProjectIds: Set<string>) =>
  state.tasks.filter((task) =>
    task.status !== "split" &&
    task.status !== "archived" &&
    sourceProjectIds.has(task.projectId),
  );

const localDateForTimestamp = (timestamp?: string) => {
  if (!timestamp) return undefined;
  const value = new Date(timestamp);
  return Number.isFinite(value.getTime()) ? todayKey(value) : undefined;
};

const sessionTouchesDate = (session: WorkSession, date: string, currentDate: string) => {
  const start = localDateForTimestamp(session.startedAt);
  const end = localDateForTimestamp(session.endedAt ?? (session.status === "paused" ? session.pausedAt : undefined)) ??
    (session.status === "active" ? currentDate : start);
  return Boolean(start && end && start <= date && date <= end);
};

export const buildMemberStatusModel = (state: AppState, projectId?: string, date = today(), workspaceId?: string) => {
  const sourceProjectIds = sourceProjectIdsForMemberStatus(state, projectId, workspaceId);
  const accessibleWorkspaceIds = activeWorkspaceIdsForCurrentAccount(state);
  const sourceWorkspaceIds = new Set(
    state.projects.filter((project) => sourceProjectIds.has(project.id)).map((project) => workspaceIdForProject(state, project))
      .filter((id): id is string => typeof id === "string" && accessibleWorkspaceIds.has(id)),
  );
  const sourceProjectMembers = state.projectMembers.filter((member) => sourceProjectIds.has(member.projectId) && member.status !== "disabled");
  const sourceWorkspaceMemberships = workspaceMembershipsForState(state).filter(
    (membership) => sourceWorkspaceIds.has(membership.workspaceId) && membership.status === "active",
  );
  const people = buildMemberStatusPeople(sourceProjectMembers, sourceWorkspaceMemberships);
  const tasksById = new Map(sourceTasksForMemberStatus(state, sourceProjectIds).map((task) => [task.id, task]));
  const planOwnersByTaskId = new Map<string, Set<string>>();
  for (const plan of state.dailyPlans) {
    if (plan.date !== date) continue;
    for (const taskId of plan.committedTaskIds) {
      const task = tasksById.get(taskId);
      // Combined plans can span workspaces; the task's current project controls visibility.
      if (!task) continue;
      const owners = planOwnersByTaskId.get(taskId) ?? new Set<string>();
      if (plan.ownerAccountId) owners.add(plan.ownerAccountId);
      planOwnersByTaskId.set(taskId, owners);
    }
  }
  const currentDate = today();
  const sessionsByTaskId = new Map<string, WorkSession[]>();
  for (const session of state.workSessions) {
    if (!tasksById.has(session.taskId) || !sessionTouchesDate(session, date, currentDate)) continue;
    const sessions = sessionsByTaskId.get(session.taskId) ?? [];
    sessions.push(session);
    sessionsByTaskId.set(session.taskId, sessions);
  }
  const todayTasks = [...tasksById.values()].filter((task) =>
    planOwnersByTaskId.has(task.id) || sessionsByTaskId.has(task.id) ||
    (task.status === "completed" && localDateForTimestamp(task.completedAt) === date) ||
    (task.status === "pending_review" && localDateForTimestamp(task.reviewSubmittedAt) === date),
  );
  const personByAccountId = new Map(people.filter((person) => person.accountId).map((person) => [person.accountId!, person]));
  const personForMemberId = (memberId: string | undefined, taskProjectId: string) => memberId
    ? people.find((person) => person.members.some((member) => member.id === memberId && member.projectId === taskProjectId))
    : undefined;
  const personForSession = (session: WorkSession, taskProjectId: string) =>
    personForMemberId(session.executorMemberId, taskProjectId) ??
    (session.ownerAccountId ? personByAccountId.get(session.ownerAccountId) : undefined);
  const tasksByPersonId = new Map(people.map((person) => [person.id, [] as typeof todayTasks]));
  const unresolvedTasks: typeof todayTasks = [];
  for (const task of todayTasks) {
    const recipients = new Set(people.filter((person) =>
      taskBelongsToMemberStatusPerson(task, person, new Set(person.memberIds)),
    ).map((person) => person.id));
    for (const session of sessionsByTaskId.get(task.id) ?? []) {
      const person = personForSession(session, task.projectId);
      if (person) recipients.add(person.id);
    }
    const unassigned = !task.primaryExecutorMemberId && !(task.collaboratorMemberIds?.length);
    if (unassigned) {
      for (const ownerId of planOwnersByTaskId.get(task.id) ?? []) {
        const person = personByAccountId.get(ownerId);
        if (person) recipients.add(person.id);
      }
      const submitter = personForMemberId(task.reviewSubmittedByMemberId, task.projectId);
      if (submitter && (localDateForTimestamp(task.reviewSubmittedAt) === date || localDateForTimestamp(task.completedAt) === date)) {
        recipients.add(submitter.id);
      }
    }
    if (!recipients.size) unresolvedTasks.push(task);
    for (const id of recipients) tasksByPersonId.get(id)!.push(task);
  }
  const projectNameById = new Map(state.projects.map((project) => [project.id, project.name]));
  const workspaceNameByProjectId = new Map(
    state.projects.flatMap((project): [string, string][] => {
      const name = workspaceForProject(state, project)?.name;
      return name ? [[project.id, name]] : [];
    }),
  );
  const runningSessions = date === currentDate ? [...sessionsByTaskId.values()].flat()
    .filter((session) => session.status === "active" && !session.endedAt &&
      ["committed", "in_progress"].includes(tasksById.get(session.taskId)!.status))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()) : [];
  const columns: MemberStatusColumn[] = people.map((person) => {
    const runningSession = runningSessions.find((session) =>
      personForSession(session, tasksById.get(session.taskId)!.projectId)?.id === person.id);
    const runningTask = runningSession ? tasksById.get(runningSession.taskId) : undefined;
    const displayedTasks = sortMemberStatusTasks(tasksByPersonId.get(person.id)!, runningTask);
    return {
      ...person, displayedTasks, runningTask,
      projectTaskGroups: groupMemberTasksByProject(person, displayedTasks, projectNameById, workspaceNameByProjectId)
        .filter((group) => group.tasks.length > 0),
    };
  });
  if (unresolvedTasks.length) {
    const unresolved: MemberStatusColumn = {
      id: "member_status_unresolved", name: "归属待确认", roles: [], memberIds: [],
      projectIds: [], workspaceIds: [], members: [], workspaceMemberships: [],
      displayedTasks: sortMemberStatusTasks(unresolvedTasks), projectTaskGroups: [],
    };
    unresolved.projectTaskGroups = groupMemberTasksByProject(unresolved, unresolved.displayedTasks, projectNameById, workspaceNameByProjectId)
      .map((group) => ({ ...group, roleLabel: "未确认归属" }));
    columns.push(unresolved);
  }
  return { columns, taskCount: todayTasks.length };
};

export const buildMemberStatusColumns = (state: AppState, projectId?: string, date = today(), workspaceId?: string) =>
  buildMemberStatusModel(state, projectId, date, workspaceId).columns;

export const countMemberStatusTodayTasks = (state: AppState, projectId?: string, date = today(), workspaceId?: string) =>
  buildMemberStatusModel(state, projectId, date, workspaceId).taskCount;
