import type { ProjectMember, ProjectMemberRole, Task, WorkspaceMembership } from "./types";

export type MemberProjectTaskGroup = {
  projectId: string;
  projectName: string;
  workspaceName?: string;
  roleLabel: string;
  tasks: Task[];
};

export type MemberStatusPerson = {
  id: string;
  name: string;
  roles: ProjectMemberRole[];
  accountId?: string;
  email?: string;
  memberIds: string[];
  projectIds: string[];
  workspaceIds: string[];
  members: ProjectMember[];
  workspaceMemberships: WorkspaceMembership[];
};

export type MemberStatusColumn = MemberStatusPerson & {
  displayedTasks: Task[];
  projectTaskGroups: MemberProjectTaskGroup[];
  runningTask?: Task;
};
