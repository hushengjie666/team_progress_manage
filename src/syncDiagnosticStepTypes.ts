import type { AppState, SyncDiagnosticStep } from "./types";

export type DiagnosticStepResult = {
  state?: AppState;
  step: SyncDiagnosticStep;
  lastError?: string;
};
