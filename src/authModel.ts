import { uid } from "./seed";
import type { AppState, AuthState, TeamMember } from "./types";

export const bindAccountToMembers = (value: AppState, auth: AuthState, timestamp = new Date().toISOString()): AppState => {
  const account = auth.account;
  if (!account) return value;

  const existingTeamMember =
    value.teamMembers.find((member) => member.accountId === account.id) ??
    value.teamMembers.find((member) => !member.accountId && member.email?.toLowerCase() === account.email.toLowerCase());

  const teamMember: TeamMember = existingTeamMember
    ? {
        ...existingTeamMember,
        accountId: account.id,
        name: existingTeamMember.name || account.name,
        email: existingTeamMember.email ?? account.email,
        status: existingTeamMember.status ?? "active",
        updatedAt: timestamp,
      }
    : {
        id: uid("team_member"),
        accountId: account.id,
        name: account.name,
        email: account.email,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

  const teamMembers = existingTeamMember
    ? value.teamMembers.map((member) => (member.id === existingTeamMember.id ? teamMember : member))
    : [teamMember, ...value.teamMembers];

  const hasAccountOwnerForProject = (projectId: string) =>
    value.projectMembers.some((member) => member.projectId === projectId && member.accountId === account.id && member.roles.includes("project_owner"));
  const accountEmail = account.email.toLowerCase();
  const shouldBindProjectMember = (member: AppState["projectMembers"][number]) => {
    if (member.accountId === account.id) return true;
    if (member.accountId) return false;
    if (member.teamMemberId && member.teamMemberId === teamMember.id) return true;
    if (member.email?.toLowerCase() === accountEmail) return true;
    return member.roles.includes("project_owner") && !hasAccountOwnerForProject(member.projectId) && !member.email;
  };

  const projectMembers = value.projectMembers.map((member) =>
    shouldBindProjectMember(member)
      ? {
          ...member,
          teamMemberId: teamMember.id,
          accountId: account.id,
          name: member.name || account.name,
          email: member.email ?? account.email,
          status: member.status ?? "active",
          updatedAt: timestamp,
        }
      : { ...member, status: member.status ?? "active" },
  );

  const currentMember =
    projectMembers.find((member) => member.id === value.currentMemberId && member.accountId === account.id) ??
    projectMembers.find((member) => member.accountId === account.id) ??
    projectMembers[0];

  return {
    ...value,
    auth,
    teamMembers,
    currentMemberId: currentMember?.id,
    projectMembers,
    sync: {
      ...value.sync,
      enabled: true,
      autoSync: true,
      token: auth.token,
      username: account.email,
      message: auth.message,
      status: "idle",
      retryCount: 0,
      nextRetryAt: undefined,
    },
    updatedAt: timestamp,
  };
};
