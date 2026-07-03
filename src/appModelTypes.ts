import type { Task } from "./types";

export type Tab = "workspace" | "workspaces" | "project" | "member_status" | "focus" | "calendar" | "daily" | "reports" | "settings";

export type DeletedTaskSnapshot = {
  task: Task;
  committedPlanIds: string[];
  deletedAt: string;
};

export type SplitDraft = {
  task: Task;
  text: string;
};
