import { timed } from "./teamBackendDiagnosticHttp";
import type { DiagnosticStepResult } from "./teamBackendDiagnosticStepTypes";
import { loadTeamData, saveTeamDataSnapshot } from "./teamApi";
import type { AppState, BackendDiagnosticStep } from "./types";

export const unauthenticatedTeamDiagnosticSteps = (): BackendDiagnosticStep[] => [
  { id: "save", label: "保存检查", ok: false, detail: "未登录，无法保存。" },
  { id: "load", label: "读取检查", ok: false, detail: "未登录，无法读取。" },
];

export const runSaveDiagnosticStep = async (workingState: AppState, token: string): Promise<DiagnosticStepResult> => {
  try {
    const saveResult = await timed(() => saveTeamDataSnapshot(workingState.backend, token, workingState));
    return {
      state: saveResult.result,
      step: {
        id: "save",
        label: "保存检查",
        ok: true,
        latencyMs: saveResult.latencyMs,
        detail: "团队业务数据可保存。",
      },
    };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "保存检查失败";
    return {
      lastError,
      step: { id: "save", label: "保存检查", ok: false, detail: lastError },
    };
  }
};

export const runLoadDiagnosticStep = async (workingState: AppState): Promise<DiagnosticStepResult> => {
  try {
    const loadResult = await timed(() => loadTeamData(workingState));
    return {
      state: loadResult.result,
      step: {
        id: "load",
        label: "读取检查",
        ok: true,
        latencyMs: loadResult.latencyMs,
        detail: "团队业务数据可读取。",
      },
    };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "读取检查失败";
    return {
      lastError,
      step: { id: "load", label: "读取检查", ok: false, detail: lastError },
    };
  }
};
