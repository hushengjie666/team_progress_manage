import type { AppState, AuthState, ProjectMember, Task } from "./types";

type AuthAccount = NonNullable<AuthState["account"]>;

const normalizedEmail = (email?: string) => email?.trim().toLowerCase();

const isActiveProjectMember = (member: ProjectMember) => member.status !== "disabled";

export const sameMemberIdentity = (left: ProjectMember, right: ProjectMember) => {
  if (left.id === right.id) return true;
  if (left.accountId && right.accountId && left.accountId === right.accountId) return true;
  if (left.teamMemberId && right.teamMemberId && left.teamMemberId === right.teamMemberId) return true;
  if (left.email && right.email && left.email.toLowerCase() === right.email.toLowerCase()) return true;
  return false;
};

export const projectMemberMatchesAccount = (state: AppState, member: ProjectMember, account: AuthAccount) => {
  const accountEmail = normalizedEmail(account.email);
  const teamMember = member.teamMemberId ? state.teamMembers.find((item) => item.id === member.teamMemberId) : undefined;
  return Boolean(
    member.accountId === account.id ||
    (accountEmail && normalizedEmail(member.email) === accountEmail) ||
    teamMember?.accountId === account.id ||
    (accountEmail && normalizedEmail(teamMember?.email) === accountEmail),
  );
};

export const currentProjectMemberForAccount = (state: AppState) => {
  const account = state.auth.account;
  if (!account) return undefined;
  const currentMember = state.projectMembers.find((member) => member.id === state.currentMemberId && isActiveProjectMember(member));
  if (currentMember && projectMemberMatchesAccount(state, currentMember, account)) return currentMember;
  return state.projectMembers.find((member) => isActiveProjectMember(member) && projectMemberMatchesAccount(state, member, account));
};

export const resolveCurrentMember = (state: AppState): ProjectMember | undefined =>
  state.auth.account
    ? currentProjectMemberForAccount(state)
    : state.projectMembers.find((member) => member.id === state.currentMemberId && isActiveProjectMember(member)) ??
      state.projectMembers.find(isActiveProjectMember);

export const resolveMemberForProject = (state: AppState, projectId: string): ProjectMember | undefined => {
  const account = state.auth.account;
  if (account) {
    return state.projectMembers.find(
      (member) => member.projectId === projectId && isActiveProjectMember(member) && projectMemberMatchesAccount(state, member, account),
    );
  }

  const currentMember = resolveCurrentMember(state);
  if (!currentMember) return undefined;
  if (currentMember.projectId === projectId && isActiveProjectMember(currentMember)) return currentMember;
  return state.projectMembers.find(
    (member) => member.projectId === projectId && isActiveProjectMember(member) && sameMemberIdentity(member, currentMember),
  );
};

export const resolveMemberIdForProject = (state: AppState, projectId: string) =>
  resolveMemberForProject(state, projectId)?.id;

export const projectMemberIdentityIds = (state: AppState, currentMember = resolveCurrentMember(state)) => {
  if (!currentMember) return new Set<string>();
  return new Set(
    state.projectMembers
      .filter((member) => isActiveProjectMember(member) && sameMemberIdentity(member, currentMember))
      .map((member) => member.id),
  );
};

export const taskAssignedToMemberIdentity = (task: Task, memberIds: Set<string>, options: { includeUnassigned?: boolean } = {}) => {
  const collaboratorMemberIds = task.collaboratorMemberIds ?? [];
  const isUnassigned = !task.primaryExecutorMemberId && collaboratorMemberIds.length === 0;

  return Boolean(
    (options.includeUnassigned && isUnassigned) ||
    (task.primaryExecutorMemberId && memberIds.has(task.primaryExecutorMemberId)) ||
    collaboratorMemberIds.some((memberId) => memberIds.has(memberId)),
  );
};

const projectOwnerProjectIdsForMemberIdentity = (state: AppState, memberIds: Set<string>) =>
  new Set(
    state.projectMembers
      .filter((member) => isActiveProjectMember(member) && memberIds.has(member.id) && member.roles.includes("project_owner"))
      .map((member) => member.projectId),
  );

const taskOwnedByProjectOwnerIdentity = (task: Task, projectOwnerProjectIds: Set<string>) => {
  const collaboratorMemberIds = task.collaboratorMemberIds ?? [];
  const isUnassigned = !task.primaryExecutorMemberId && collaboratorMemberIds.length === 0;
  return isUnassigned && projectOwnerProjectIds.has(task.projectId);
};

const taskWorkedByMemberIdentity = (state: AppState, task: Task, memberIds: Set<string>) =>
  state.workSessions.some((session) => session.taskId === task.id && session.executorMemberId && memberIds.has(session.executorMemberId));

export const taskBelongsToMemberIdentity = (
  state: AppState,
  task: Task,
  memberIds: Set<string>,
  options: { includeProjectOwnerUnassigned?: boolean; includeUnassigned?: boolean } = {},
) =>
  taskAssignedToMemberIdentity(task, memberIds, { includeUnassigned: options.includeUnassigned }) ||
  taskWorkedByMemberIdentity(state, task, memberIds) ||
  (options.includeProjectOwnerUnassigned && taskOwnedByProjectOwnerIdentity(task, projectOwnerProjectIdsForMemberIdentity(state, memberIds)));
