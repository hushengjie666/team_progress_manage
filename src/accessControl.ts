import {
  projectMemberIdentityIds,
  resolveCurrentMember,
  sameMemberIdentity,
  taskAssignedToMemberIdentity,
  taskBelongsToMemberIdentity,
} from "./memberIdentity";
import type {
  Account,
  AppState,
  Project,
  ProjectMember,
  ProjectMemberRole,
  Task,
  Workspace,
  WorkspaceMembership,
} from "./types";

type MemberIdentity = {
  id?: string;
  accountId?: string;
  email?: string;
};

export type ProjectAccessibleMember = {
  id: string;
  identityKey: string;
  name: string;
  email?: string;
  source: "project" | "workspace";
  sourceLabel: string;
  roles: ProjectMemberRole[];
  projectMember?: ProjectMember;
  workspaceMembership?: WorkspaceMembership;
};

const normalizedEmail = (email?: string) => email?.trim().toLowerCase();

export const memberAccessIdentityKey = (member: MemberIdentity) => {
  if (member.accountId) return `account:${member.accountId}`;
  if (member.email) return `email:${normalizedEmail(member.email)}`;
  return `member:${member.id ?? ""}`;
};

export const memberAccessIdentityAliases = (member: MemberIdentity) => {
  const aliases: string[] = [];
  if (member.accountId) aliases.push(`account:${member.accountId}`);
  const email = normalizedEmail(member.email);
  if (email) aliases.push(`email:${email}`);
  if (member.id) aliases.push(`member:${member.id}`);
  return Array.from(new Set(aliases.length ? aliases : [memberAccessIdentityKey(member)]));
};

const addMemberAccessIdentity = (
  identities: Set<string>,
  identityAliasToKey: Map<string, string>,
  member: MemberIdentity,
) => {
  const aliases = memberAccessIdentityAliases(member);
  const existingKey = aliases
    .map((alias) => identityAliasToKey.get(alias))
    .find((key): key is string => Boolean(key && identities.has(key)));
  const identityKey = existingKey ?? memberAccessIdentityKey(member);
  aliases.forEach((alias) => identityAliasToKey.set(alias, identityKey));
  identities.add(identityKey);
};

export const workspaceMembershipsForState = (state: AppState) => {
  const memberships = state.auth.workspaceMemberships ?? [];
  const currentMembership = state.auth.membership;
  if (
    !currentMembership ||
    memberships.some(
      (membership) =>
        membership.id === currentMembership.id ||
        (membership.workspaceId === currentMembership.workspaceId && membership.accountId === currentMembership.accountId),
    )
  ) {
    return memberships;
  }
  return [...memberships, currentMembership];
};

export const workspacesForState = (state: AppState) =>
  state.auth.workspaces ?? (state.auth.workspace ? [state.auth.workspace] : []);

export const workspaceForProject = (state: AppState, project: Project) =>
  project.workspaceId
    ? workspacesForState(state).find((item) => item.id === project.workspaceId) ?? state.auth.workspace
    : state.auth.workspace;

export const workspaceIdForProject = (state: AppState, project: Project) =>
  project.workspaceId ?? workspaceForProject(state, project)?.id;

const accountBelongsToWorkspace = (
  workspace: Workspace | undefined,
  account: Pick<Account, "id" | "email" | "workspaceId"> | undefined,
  activeMemberships: WorkspaceMembership[],
  workspaceId: string,
) =>
  Boolean(
    account &&
      (
        account.workspaceId === workspaceId ||
        workspace?.ownerAccountId === account.id ||
        activeMemberships.some((membership) => membership.accountId === account.id)
      ),
  );

export const activeWorkspaceIdsForAccount = (state: AppState, account?: Pick<Account, "id" | "email" | "workspaceId">) => {
  if (!account?.id) return new Set<string>();
  const workspaceMemberships = workspaceMembershipsForState(state);
  const workspaceIds = new Set(
    workspaceMemberships
      .filter((membership) => membership.accountId === account.id && membership.status === "active")
      .map((membership) => membership.workspaceId),
  );

  workspacesForState(state)
    .filter((workspace) => workspace.ownerAccountId === account.id)
    .forEach((workspace) => workspaceIds.add(workspace.id));

  if (state.auth.workspace?.ownerAccountId === account.id) workspaceIds.add(state.auth.workspace.id);

  return workspaceIds;
};

export const activeWorkspaceIdsForCurrentAccount = (state: AppState) =>
  activeWorkspaceIdsForAccount(state, state.auth.account);

const projectMemberMatchesIdentity = (state: AppState, member: ProjectMember, identity: MemberIdentity) => {
  const identityEmail = normalizedEmail(identity.email);
  return Boolean(
    (identity.accountId && member.accountId === identity.accountId) ||
    (identityEmail && normalizedEmail(member.email) === identityEmail),
  );
};

const accountIdentity = (account: Account): MemberIdentity => ({
  id: account.id,
  accountId: account.id,
  email: account.email,
});

const accountProjectMemberIds = (state: AppState, account?: Account, currentMember?: ProjectMember) => {
  if (currentMember) return projectMemberIdentityIds(state, currentMember);
  if (!account) return projectMemberIdentityIds(state, resolveCurrentMember(state));
  return new Set(
    state.projectMembers
      .filter((member) => member.status !== "disabled" && projectMemberMatchesIdentity(state, member, accountIdentity(account)))
      .map((member) => member.id),
  );
};

export const accessibleProjectIdsForAccount = (state: AppState, account?: Account, currentMember?: ProjectMember) => {
  const memberIds = accountProjectMemberIds(state, account, currentMember);
  const workspaceIds = activeWorkspaceIdsForAccount(state, account);
  const projectIds = new Set<string>();

  state.projectMembers
    .filter((member) => member.status !== "disabled" && memberIds.has(member.id))
    .forEach((member) => projectIds.add(member.projectId));

  state.projects
    .filter((project) => {
      const workspaceId = workspaceIdForProject(state, project);
      return workspaceId ? workspaceIds.has(workspaceId) : false;
    })
    .forEach((project) => projectIds.add(project.id));

  return projectIds;
};

export const accessibleProjectIdsForCurrentUser = (state: AppState, currentMember?: ProjectMember) =>
  accessibleProjectIdsForAccount(state, state.auth.account, currentMember);

export const visibleProjectsForAccount = (state: AppState, account = state.auth.account) => {
  if (!account) return state.projects;
  const accessibleProjectIds = accessibleProjectIdsForAccount(state, account);
  return state.projects.filter((project) => accessibleProjectIds.has(project.id));
};

export const visibleTasksForAccount = (state: AppState, account = state.auth.account) => {
  const accessibleProjectIds = accessibleProjectIdsForAccount(state, account);
  return state.tasks.filter((task) => accessibleProjectIds.has(task.projectId));
};

export const countProjectAccessibleMembers = (state: AppState, project: Project, workspaceId?: string) => {
  const identities = new Set<string>();
  const identityAliasToKey = new Map<string, string>();
  if (workspaceId) {
    const workspace = workspacesForState(state).find((item) => item.id === workspaceId);
    if (workspace?.ownerAccountId) addMemberAccessIdentity(identities, identityAliasToKey, { accountId: workspace.ownerAccountId });
    const activeMemberships = workspaceMembershipsForState(state)
      .filter((membership) => membership.workspaceId === workspaceId && membership.status === "active");
    activeMemberships.forEach((membership) => addMemberAccessIdentity(identities, identityAliasToKey, membership));
  }
  state.projectMembers
    .filter((member) => member.projectId === project.id && member.status !== "disabled")
    .forEach((member) => addMemberAccessIdentity(identities, identityAliasToKey, member));
  return identities.size;
};

export const countWorkspacePeople = (
  state: AppState,
  workspace: string | Pick<Workspace, "id" | "ownerAccountId" | "type">,
  currentAccount = state.auth.account,
) => {
  const workspaceId = typeof workspace === "string" ? workspace : workspace.id;
  const workspaceSummary = typeof workspace === "string"
    ? workspacesForState(state).find((item) => item.id === workspaceId)
    : workspace;
  const identities = new Set<string>();
  const activeMemberships = workspaceMembershipsForState(state)
    .filter((membership) => membership.workspaceId === workspaceId && membership.status === "active");
  const isPrivateWorkspace = (workspaceSummary?.type ?? "shared") === "private";
  if (isPrivateWorkspace) {
    const ownerAccountId =
      workspaceSummary?.ownerAccountId ||
      activeMemberships.find((membership) => membership.role === "owner")?.accountId ||
      currentAccount?.id ||
      "";
    if (ownerAccountId) identities.add(`account:${ownerAccountId}`);
    else if (currentAccount?.email) identities.add(`email:${normalizedEmail(currentAccount.email)}`);
    return identities.size;
  }

  if (workspaceSummary?.ownerAccountId) identities.add(`account:${workspaceSummary.ownerAccountId}`);
  if (accountBelongsToWorkspace(workspaceSummary as Workspace | undefined, currentAccount, activeMemberships, workspaceId)) {
    if (currentAccount?.id) identities.add(`account:${currentAccount.id}`);
    else if (currentAccount?.email) identities.add(`email:${normalizedEmail(currentAccount.email)}`);
  }
  activeMemberships.forEach((membership) => identities.add(memberAccessIdentityKey(membership)));
  return identities.size;
};

export const countActiveWorkspaceMembers = (
  workspace: string | Pick<Workspace, "id" | "ownerAccountId" | "type">,
  workspaceMemberships: WorkspaceMembership[],
  currentAccount?: Pick<Account, "id" | "email" | "workspaceId">,
) => {
  const workspaceId = typeof workspace === "string" ? workspace : workspace.id;
  const identities = new Set<string>();
  const activeMemberships = workspaceMemberships.filter((membership) => membership.workspaceId === workspaceId && membership.status === "active");
  const isPrivateWorkspace = typeof workspace !== "string" && (workspace.type ?? "shared") === "private";
  if (isPrivateWorkspace) {
    const ownerAccountId =
      workspace.ownerAccountId ||
      activeMemberships.find((membership) => membership.role === "owner")?.accountId ||
      currentAccount?.id ||
      "";
    const ownerMembership = activeMemberships.find((membership) => membership.accountId === ownerAccountId);
    if (ownerAccountId) identities.add(`account:${ownerAccountId}`);
    else if (ownerMembership) identities.add(memberAccessIdentityKey(ownerMembership));
    else if (currentAccount?.email) identities.add(`email:${normalizedEmail(currentAccount.email)}`);
    return identities.size;
  }
  const currentAccountBelongsToWorkspace = Boolean(
    currentAccount &&
    (
      currentAccount.workspaceId === workspaceId ||
      (typeof workspace !== "string" && workspace.ownerAccountId === currentAccount.id)
    ),
  );
  if (typeof workspace !== "string" && workspace.ownerAccountId) {
    identities.add(`account:${workspace.ownerAccountId}`);
  }
  if (currentAccount && currentAccountBelongsToWorkspace) {
    if (currentAccount.id) identities.add(`account:${currentAccount.id}`);
    else if (currentAccount.email) identities.add(`email:${normalizedEmail(currentAccount.email)}`);
  }
  activeMemberships.forEach((membership) => identities.add(memberAccessIdentityKey(membership)));
  return identities.size;
};

export const visibleWorkspaceMembers = (
  workspace: Workspace,
  memberships: WorkspaceMembership[],
  currentAccount?: Account,
) => {
  const members = memberships.filter((membership) => membership.workspaceId === workspace.id);
  if ((workspace.type ?? "shared") !== "private") return members;
  const ownerAccountId =
    workspace.ownerAccountId ||
    members.find((member) => member.role === "owner" && member.status === "active")?.accountId ||
    currentAccount?.id ||
    "";
  return members.filter((member) => member.accountId === ownerAccountId);
};

const memberIdentityForProjectMember = (member: ProjectMember) => ({
  id: member.id,
  accountId: member.accountId,
  email: member.email,
});

export const buildAccessibleProjectMembers = (
  state: AppState,
  projectMembers: ProjectMember[],
  workspaceId?: string,
) => {
  const rows = new Map<string, ProjectAccessibleMember>();
  const identityAliasToKey = new Map<string, string>();
  const activeWorkspaceMemberships = workspaceId
    ? workspaceMembershipsForState(state).filter((membership) => membership.workspaceId === workspaceId && membership.status === "active")
    : [];

  const resolveAccessibleMemberKey = (identity: MemberIdentity) => {
    const aliases = memberAccessIdentityAliases(identity);
    const existingKey = aliases
      .map((alias) => identityAliasToKey.get(alias))
      .find((key): key is string => Boolean(key && rows.has(key)));
    const identityKey = existingKey ?? memberAccessIdentityKey(identity);
    aliases.forEach((alias) => identityAliasToKey.set(alias, identityKey));
    return identityKey;
  };

  const addWorkspaceMember = (
    identity: MemberIdentity,
    value: {
      name: string;
      email?: string;
      sourceLabel: string;
      workspaceMembership?: WorkspaceMembership;
    },
  ) => {
    const identityKey = resolveAccessibleMemberKey(identity);
    const existing = rows.get(identityKey);
    if (existing) {
      rows.set(identityKey, {
        ...existing,
        email: existing.email ?? value.email,
        workspaceMembership: existing.workspaceMembership ?? value.workspaceMembership,
      });
      return;
    }
    rows.set(identityKey, {
      id: `workspace:${identityKey}`,
      identityKey,
      name: value.name,
      email: value.email,
      source: "workspace",
      sourceLabel: value.sourceLabel,
      roles: ["executor"],
      workspaceMembership: value.workspaceMembership,
    });
  };

  projectMembers.forEach((member) => {
    const identityKey = resolveAccessibleMemberKey(memberIdentityForProjectMember(member));
    const existing = rows.get(identityKey);
    rows.set(identityKey, {
      id: member.id,
      identityKey,
      name: member.name ?? existing?.name ?? "项目成员",
      email: member.email ?? existing?.email,
      source: "project",
      sourceLabel: "项目成员",
      roles: existing ? Array.from(new Set([...existing.roles, ...member.roles])) : member.roles,
      projectMember: member,
      workspaceMembership: existing?.workspaceMembership,
    });
  });

  if (workspaceId) {
    const workspace = workspacesForState(state).find((item) => item.id === workspaceId);
    if (workspace?.ownerAccountId) {
      const ownerMembership = activeWorkspaceMemberships.find((membership) => membership.accountId === workspace.ownerAccountId);
      const ownerAccount = state.auth.account?.id === workspace.ownerAccountId ? state.auth.account : undefined;
      addWorkspaceMember(
        {
          accountId: workspace.ownerAccountId,
          email: ownerMembership?.email ?? ownerAccount?.email,
        },
        {
          name: ownerMembership?.name ?? ownerAccount?.name ?? "工作区负责人",
          email: ownerMembership?.email ?? ownerAccount?.email,
          sourceLabel: "工作区负责人",
          workspaceMembership: ownerMembership,
        },
      );
    }
    if (state.auth.account) {
      const currentMembership = activeWorkspaceMemberships.find((membership) => membership.accountId === state.auth.account?.id);
      if (accountBelongsToWorkspace(workspace, state.auth.account, activeWorkspaceMemberships, workspaceId)) {
        addWorkspaceMember(
          {
            accountId: state.auth.account.id,
            email: currentMembership?.email ?? state.auth.account.email,
          },
          {
            name: currentMembership?.name ?? state.auth.account.name,
            email: currentMembership?.email ?? state.auth.account.email,
            sourceLabel: currentMembership?.role === "owner" || workspace?.ownerAccountId === state.auth.account.id ? "工作区负责人" : "工作区成员",
            workspaceMembership: currentMembership,
          },
        );
      }
    }
    activeWorkspaceMemberships.forEach((membership) => {
      addWorkspaceMember(
        membership,
        {
          name: membership.name || membership.email,
          email: membership.email,
          sourceLabel: membership.role === "owner" ? "工作区负责人" : "工作区成员",
          workspaceMembership: membership,
        },
      );
    });
  }

  return [...rows.values()].sort((left, right) => {
    if (left.source !== right.source) return left.source === "project" ? -1 : 1;
    return left.name.localeCompare(right.name, "zh-Hans-CN");
  });
};

export const canManageWorkspace = (state: AppState, workspaceId: string, account = state.auth.account) => {
  if (!account?.id) return false;
  const workspace = workspacesForState(state).find((item) => item.id === workspaceId);
  if (workspace?.ownerAccountId === account.id) return true;
  return workspaceMembershipsForState(state).some(
    (membership) =>
      membership.workspaceId === workspaceId &&
      membership.accountId === account.id &&
      membership.status === "active" &&
      (membership.role === "owner" || membership.role === "admin"),
  );
};

export const resolveProjectMemberForAccount = (state: AppState, projectId: string, account = state.auth.account) => {
  if (!account) return undefined;
  return state.projectMembers.find(
    (member) => member.projectId === projectId && member.status !== "disabled" && projectMemberMatchesIdentity(state, member, accountIdentity(account)),
  );
};

export const canManageProjectMembers = (state: AppState, projectId: string, account = state.auth.account) => {
  const project = state.projects.find((item) => item.id === projectId);
  const workspaceId = project ? workspaceIdForProject(state, project) : undefined;
  if (workspaceId && canManageWorkspace(state, workspaceId, account)) return true;
  if (!account) {
    const currentMember = resolveCurrentMember(state);
    return Boolean(
      currentMember?.projectId === projectId &&
      currentMember.status !== "disabled" &&
      currentMember.roles.includes("project_owner"),
    );
  }
  return Boolean(resolveProjectMemberForAccount(state, projectId, account)?.roles.includes("project_owner"));
};

export const canReviewProjectTasks = (state: AppState, projectId: string, account = state.auth.account) =>
  canManageProjectMembers(state, projectId, account);

export {
  projectMemberIdentityIds,
  sameMemberIdentity,
  taskAssignedToMemberIdentity,
  taskBelongsToMemberIdentity,
};
