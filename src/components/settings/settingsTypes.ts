export type SettingsSection = "members" | "timer" | "sync" | "data" | "demo";

export type SettingsDataSummary = {
  projectCount: number;
  taskCount: number;
  projectMemberCount: number;
  focusSessionCount: number;
  workSessionCount: number;
  executionSignalCount: number;
  interruptionCount: number;
};
