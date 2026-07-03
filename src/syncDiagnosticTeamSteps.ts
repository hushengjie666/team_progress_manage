import { authHeaders, apiUrl, readResponse, timed } from "./syncDiagnosticHttp";
import type { DiagnosticStepResult } from "./syncDiagnosticStepTypes";
import { getTeamRevision, loadTeamState } from "./teamApi";
import type { AppState, SyncDiagnosticStep } from "./types";

export const unauthenticatedTeamDiagnosticSteps = (): SyncDiagnosticStep[] => [
  { id: "push", label: "写入检查", ok: false, detail: "未登录，无法写入。" },
  { id: "pull", label: "拉取检查", ok: false, detail: "未登录，无法拉取。" },
];

export const runPushDiagnosticStep = async (workingState: AppState, token: string): Promise<DiagnosticStepResult> => {
  try {
    const pushResult = await timed(async () =>
      readResponse<{ current_revision: number }>(await fetch(apiUrl(workingState.sync.serverUrl, "/team/changes"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          device_id: workingState.sync.deviceId,
          changes: [],
        }),
      })),
    );
    return {
      step: {
        id: "push",
        label: "写入检查",
        ok: true,
        latencyMs: pushResult.latencyMs,
        detail: `团队变更接口可写，远端 revision ${pushResult.result.current_revision}。`,
      },
    };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "写入检查失败";
    return {
      lastError,
      step: { id: "push", label: "写入检查", ok: false, detail: lastError },
    };
  }
};

export const runPullDiagnosticStep = async (workingState: AppState, token: string): Promise<DiagnosticStepResult> => {
  try {
    const pullResult = await timed(() => loadTeamState(workingState));
    const revision = await getTeamRevision(pullResult.result.sync, token);
    return {
      state: pullResult.result,
      step: {
        id: "pull",
        label: "拉取检查",
        ok: true,
        latencyMs: pullResult.latencyMs,
        detail: `团队状态可拉取，远端 revision ${revision}。`,
      },
    };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "拉取检查失败";
    return {
      lastError,
      step: { id: "pull", label: "拉取检查", ok: false, detail: lastError },
    };
  }
};
