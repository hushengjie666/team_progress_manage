import { createInitialState } from "./seed";
import { mergeRowsIntoState } from "./syncStateSync";
import type { AppState } from "./types";
import type { SyncRow } from "./syncPayloadTypes";
import { preserveLocalActiveRuntime } from "./teamActiveRuntimePreservation";
import { readTeamResponse, teamApiUrl, teamAuthHeaders } from "./teamApiHttp";

type TeamStateResponse = {
  changes: SyncRow[];
  current_revision: number;
};

const createEmptyTeamStateBase = (local: AppState, token: string): AppState => ({
  ...createInitialState(),
  auth: local.auth,
  projects: [],
  projectMembers: [],
  tasks: [],
  dailyPlans: [],
  focusSessions: [],
  workSessions: [],
  executionSignals: [],
  interruptions: [],
  sync: {
    ...local.sync,
    token,
    lastPulledRevision: 0,
    status: "idle",
    message: "团队在线模式",
    tombstones: [],
  },
});

export async function loadTeamState(local: AppState): Promise<AppState> {
  const token = local.auth.token ?? local.sync.token;
  if (!token) return local;
  const payload = await readTeamResponse<TeamStateResponse>(await fetch(teamApiUrl(local.sync.serverUrl, "/team/state/all"), {
    headers: teamAuthHeaders(token),
  }));
  const base = createEmptyTeamStateBase(local, token);
  const merged = mergeRowsIntoState(base, payload.changes, payload.current_revision, { forceRemote: true });
  const restored = preserveLocalActiveRuntime(merged, local);
  return {
    ...restored,
    auth: local.auth,
    sync: {
      ...restored.sync,
      token,
      serverUrl: local.sync.serverUrl,
      username: local.auth.account?.email ?? local.sync.username,
      status: "synced",
      message: "团队在线数据已加载",
      lastPulledRevision: payload.current_revision,
    },
  };
}
