import type { TaskStatus } from "./types";

export type ProjectOverviewCard = {
  projectId: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: "private" | "shared";
  name: string;
  description: string;
  progressPercent: number;
  memberCount: number;
  taskCount: number;
  activeSessionCount: number;
  inProgressCount: number;
  pendingReviewCount: number;
  riskCount: number;
  assignedNotStartedCount: number;
  statusCounts: Record<TaskStatus, number>;
};

export type MyProjectTaskCard = {
  projectId: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: "private" | "shared";
  name: string;
  description: string;
  progressPercent: number;
  myTaskCount: number;
  inProgressCount: number;
  pendingReviewCount: number;
  poolCount: number;
  committedCount: number;
};
