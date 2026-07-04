import type { AppState, BackendDiagnosticStep } from "./types";

export type DiagnosticStepResult = {
  state?: AppState;
  step: BackendDiagnosticStep;
  lastError?: string;
};
