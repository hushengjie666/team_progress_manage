import type { AppState } from "./types";

export const isIncompleteRecoveredRecord = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || !("recovery" in value)) return false;
  const metadata = value.recovery;
  return Boolean(metadata && typeof metadata === "object"
    && "source" in metadata && metadata.source === "navicat_missing_payload"
    && "originalPayloadAvailable" in metadata && metadata.originalPayloadAvailable === false);
};

export const incompleteRecoveryCount = (state: AppState): number => [
  ...state.projects,
  ...state.projectMembers,
  ...state.tasks,
  ...state.dailyPlans,
  ...state.focusSessions,
  ...state.workSessions,
  ...state.executionSignals,
  ...state.interruptions,
  state.rewardState,
].filter(isIncompleteRecoveredRecord).length;
