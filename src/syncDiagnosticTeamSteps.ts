import { authHeaders, apiUrl, readResponse, timed } from "./syncDiagnosticHttp";
import type { DiagnosticStepResult } from "./syncDiagnosticStepTypes";
import { loadTeamBusinessState } from "./teamApi";
import type { AppState, SyncDiagnosticStep } from "./types";

export const unauthenticatedTeamDiagnosticSteps = (): SyncDiagnosticStep[] => [
  { id: "push", label: "写入检查", ok: false, detail: "未登录，无法写入。" },
  { id: "pull", label: "拉取检查", ok: false, detail: "未登录，无法拉取。" },
];

export const runPushDiagnosticStep = async (workingState: AppState, token: string): Promise<DiagnosticStepResult> => {
  try {
    const pushResult = await timed(async () =>
      readResponse<{ rows: unknown[] }>(await fetch(apiUrl(workingState.sync.serverUrl, "/team/business-changes"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
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
        detail: `团队业务接口可写，返回 ${pushResult.result.rows.length} 条业务记录。`,
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

export const runPullDiagnosticStep = async (workingState: AppState): Promise<DiagnosticStepResult> => {
  try {
    const pullResult = await timed(() => loadTeamBusinessState(workingState));
    return {
      state: pullResult.result,
      step: {
        id: "pull",
        label: "拉取检查",
        ok: true,
        latencyMs: pullResult.latencyMs,
        detail: "团队业务状态可拉取。",
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
