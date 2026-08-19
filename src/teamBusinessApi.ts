import { applyTeamStateLoadFailure } from "./appBoot";
import { mergeBusinessRowsIntoState, type BusinessRow } from "./teamBusinessRows";
import type { AppState } from "./types";
import type { ServerAccount, ServerWorkspace, ServerWorkspaceMembership } from "./teamBackendCoreTypes";
import { apiUrl, authHeaders, requestJson, TeamHttpError } from "./teamBackendHttp";
import { mapAccount, mapWorkspace, mapWorkspaceMembership } from "./teamBackendMappers";
import { compatibilityStateForHttpError, TeamBackendCompatibilityError } from "./teamBackendCompatibility";
import { restoreTimer } from "./timerCalculations";
import type { Settings } from "./types";
import { preserveLocalUnpersistedTimer } from "./teamActiveRuntimePreservation";
import { normalizeTimerSpeedMultiplier, timerSpeedMultiplierForSettings } from "./timerSpeed";

type AppBootstrapResponse = {
  account: ServerAccount;
  workspace: ServerWorkspace;
  membership: ServerWorkspaceMembership;
  workspaces: ServerWorkspace[];
  workspace_memberships: ServerWorkspaceMembership[];
  rows: BusinessRow[];
  loaded_at: string;
  settings?: Partial<Settings>;
};

const recoverTeamActiveTimer = (
  state: AppState,
  settings: Settings,
  local: AppState,
  now = new Date(),
) => {
  const activeWork = state.workSessions.find((session) => session.status === "active" || session.status === "paused");
  const activeFocus = activeWork
    ? state.focusSessions.find((session) => session.id === activeWork.focusSessionId)
    : undefined;
  if (!activeWork || !activeFocus) return undefined;

  const duration = activeFocus.duration ?? settings.focusMinutes * 60;
  const localTimer = local.activeTimer?.workSessionId === activeWork.id ? local.activeTimer : undefined;
  const speedMultiplier = normalizeTimerSpeedMultiplier(
    localTimer?.speedMultiplier ?? timerSpeedMultiplierForSettings(settings),
  );
  const plannedEndAt = new Date(
    new Date(activeWork.startedAt).getTime()
      + (activeWork.totalPausedSeconds + duration / speedMultiplier) * 1000,
  ).toISOString();
  const referenceTime = activeWork.status === "paused"
    ? new Date(activeWork.pausedAt ?? activeWork.updatedAt)
    : now;
  const restored = restoreTimer({
    sessionId: activeFocus.id,
    taskId: activeWork.taskId,
    workSessionId: activeWork.id,
    mode: activeFocus.mode,
    duration,
    remaining: duration,
    isRunning: true,
    startedAt: activeWork.startedAt,
    plannedEndAt,
    pausedAt: activeWork.pausedAt,
    totalPausedSeconds: activeWork.totalPausedSeconds,
    cycleIndex: localTimer?.cycleIndex ?? 1,
    speedMultiplier: speedMultiplier > 1 ? speedMultiplier : undefined,
  }, referenceTime);
  if (!restored) return undefined;
  return activeWork.status === "paused"
    ? { ...restored, isRunning: false, pausedAt: activeWork.pausedAt }
    : restored;
};

export async function loadTeamData(local: AppState): Promise<AppState> {
  const token = local.auth.token ?? local.backend.token;
  if (!token) return local;
  let payload: AppBootstrapResponse;
  try {
    payload = await requestJson<AppBootstrapResponse>(apiUrl(local.backend.serverUrl, "/app/bootstrap"), {
      headers: authHeaders(token),
    });
  } catch (error) {
    if (error instanceof TeamHttpError && error.status === 404) {
      throw new TeamBackendCompatibilityError(compatibilityStateForHttpError(error));
    }
    throw error;
  }
  const merged = mergeBusinessRowsIntoState(local, payload.rows);
  const settings = { ...merged.settings, ...(payload.settings ?? {}) };
  const recoveredTimer = recoverTeamActiveTimer(merged, settings, local);
  const remoteState: AppState = {
    ...merged,
    settings,
    auth: {
      ...merged.auth,
      status: "authenticated",
      account: mapAccount(payload.account),
      workspace: mapWorkspace(payload.workspace),
      membership: mapWorkspaceMembership(payload.membership),
      workspaces: payload.workspaces.map(mapWorkspace),
      workspaceMemberships: payload.workspace_memberships.map(mapWorkspaceMembership),
      message: "已登录",
    },
    backend: {
      ...merged.backend,
      status: "ready",
      message: "团队在线数据已加载",
      lastLoadedAt: payload.loaded_at,
      failureKind: undefined,
    },
    activeTimer: recoveredTimer,
  };
  return preserveLocalUnpersistedTimer(remoteState, local);
}

export const applyTeamBusinessFailure = (state: AppState, error: unknown) =>
  applyTeamStateLoadFailure(state, error);

export async function importTeamBusinessData(local: AppState, rows: BusinessRow[]) {
  const token = local.auth.token ?? local.backend.token;
  if (!token) throw new Error("请先登录团队后台");
  await requestJson<{ rows: BusinessRow[] }>(apiUrl(local.backend.serverUrl, "/app/import"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ rows }),
  });
  return loadTeamData(local);
}
