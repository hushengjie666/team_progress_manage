import type { AppState, AuthState } from "./types";

export { currentProjectMemberForAccount, projectMemberMatchesAccount } from "./memberIdentity";

export const bindAccountToMembers = (
  value: AppState,
  auth: AuthState,
  timestamp = new Date().toISOString(),
): AppState => {
  const account = auth.account;
  if (!account) return value;

  const hasAccountOwnerForProject = (projectId: string) =>
    value.projectMembers.some((member) => member.projectId === projectId && member.accountId === account.id && member.roles.includes("project_owner"));
  const memberHasIdentity = (member: AppState["projectMembers"][number]) => {
    return Boolean(member.accountId || member.email);
  };
  const projectHasIdentifiedMember = (projectId: string) =>
    value.projectMembers.some((member) => member.projectId === projectId && memberHasIdentity(member));
  const accountEmail = account.email.toLowerCase();
  const shouldBindProjectMember = (member: AppState["projectMembers"][number]) => {
    if (member.accountId === account.id) return true;
    if (member.accountId) return false;
    if (member.email?.toLowerCase() === accountEmail) return true;
    return (
      member.roles.includes("project_owner") &&
      !hasAccountOwnerForProject(member.projectId) &&
      !projectHasIdentifiedMember(member.projectId) &&
      !member.email
    );
  };

  const projectMembers = value.projectMembers.map((member) =>
    shouldBindProjectMember(member)
      ? {
          ...member,
          accountId: account.id,
          name: member.name || account.name,
          email: member.email ?? account.email,
          status: member.status ?? "active",
          updatedAt: timestamp,
        }
      : { ...member, status: member.status ?? "active" },
  );

  return {
    ...value,
    auth,
    projectMembers,
    sync: {
      ...value.sync,
      token: auth.token,
      username: account.email,
      message: auth.message,
      status: "idle",
    },
    updatedAt: timestamp,
  };
};
