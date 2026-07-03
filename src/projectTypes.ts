import type { TaskStageMode } from "./taskTypes";

export type ProjectMemberRole = "project_owner" | "executor";

export interface Project {
  id: string;
  workspaceId?: string;
  name: string;
  description: string;
  defaultExpectedStartHours: number;
  taskStageMode?: TaskStageMode;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ProjectMember {
  id: string;
  workspaceId?: string;
  projectId: string;
  accountId?: string;
  name: string;
  email?: string;
  roles: ProjectMemberRole[];
  status?: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}
