import { countActiveWorkspaceMembers as countActiveWorkspaceMembersFromAccess } from "../../accessControl";
import type { ProjectOverviewCard } from "../../projectOverview";
import type { Account, Workspace, WorkspaceMembership, WorkspaceType } from "../../types";

export type WorkspaceDirectoryCard = {
  workspace: Workspace;
  projects: ProjectOverviewCard[];
  taskCount: number;
  memberCount: number;
  pendingReviewCount: number;
  riskCount: number;
  progressPercent: number;
};

export type WorkspaceModalState = {
  workspaceId: string;
  kind: "projects" | "members" | "edit";
};

export const workspaceTypeLabel = (workspace: Workspace) =>
  (workspace.type ?? "shared") === "private" ? "私人工作区" : "协作工作区";

export const workspaceTypeForEditSave = (currentType: WorkspaceType, draftType?: WorkspaceType): WorkspaceType =>
  currentType === "private" ? "private" : draftType ?? currentType;

export const inferWorkspaceOwnerAccountId = (
  workspace: Workspace,
  members: WorkspaceMembership[],
  fallbackAccountId?: string,
) =>
  workspace.ownerAccountId ||
  members.find((member) => member.role === "owner" && member.status === "active")?.accountId ||
  members.find((member) => member.role === "owner")?.accountId ||
  fallbackAccountId ||
  "";

export const countActiveWorkspaceMembers = countActiveWorkspaceMembersFromAccess;

const workspaceSortRank = (workspace: Workspace) => {
  const typeRank = (workspace.type ?? "shared") === "private" ? 0 : 1;
  const createdAt = new Date(workspace.createdAt).getTime();
  return typeRank * 1_000_000_000_000 + (Number.isFinite(createdAt) ? createdAt : 0);
};

export function buildWorkspaceDirectoryCards({
  workspaces,
  workspaceMemberships,
  currentAccount,
  projectCards,
}: {
  workspaces: Workspace[];
  workspaceMemberships: WorkspaceMembership[];
  currentAccount?: Account;
  projectCards: ProjectOverviewCard[];
}): WorkspaceDirectoryCard[] {
  return [...workspaces].sort((left, right) => workspaceSortRank(left) - workspaceSortRank(right) || left.id.localeCompare(right.id)).map((workspace) => {
    const cardProjects = projectCards.filter((project) => project.workspaceId === workspace.id);
    const taskCount = cardProjects.reduce((sum, project) => sum + project.taskCount, 0);
    const memberCount = countActiveWorkspaceMembers(workspace, workspaceMemberships, currentAccount);
    const pendingReviewCount = cardProjects.reduce((sum, project) => sum + project.pendingReviewCount, 0);
    const riskCount = cardProjects.reduce((sum, project) => sum + project.riskCount, 0);
    const progressPercent = cardProjects.length
      ? Math.round(cardProjects.reduce((sum, project) => sum + project.progressPercent, 0) / cardProjects.length)
      : 0;
    return { workspace, projects: cardProjects, taskCount, memberCount, pendingReviewCount, riskCount, progressPercent };
  });
}
