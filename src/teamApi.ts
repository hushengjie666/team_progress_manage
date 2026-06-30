import { createInitialState } from "./seed";
import { flattenStateToChanges, mergeRowsIntoState, type SyncRow } from "./sync";
import type { AppState, ProjectMember, SyncState } from "./types";

type TeamStateResponse = {
  changes: SyncRow[];
  current_revision: number;
};

type TeamChangeResponse = {
  accepted: SyncRow[];
  conflicts: SyncRow[];
  current_revision: number;
};

type TeamRevisionResponse = {
  current_revision: number;
};

const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

const authHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const readResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = "团队接口请求失败";
  try {
    const payload = await response.json() as { error?: string };
    message = payload.error ?? message;
  } catch {
    // keep default message
  }
  throw new Error(message);
};

const currentMemberForAccount = (state: AppState): ProjectMember | undefined => {
  const account = state.auth.account;
  if (!account) return state.projectMembers[0];
  return (
    state.projectMembers.find((member) => member.accountId === account.id) ??
    state.projectMembers.find((member) => member.email?.toLowerCase() === account.email.toLowerCase()) ??
    state.projectMembers[0]
  );
};

export async function loadTeamState(local: AppState): Promise<AppState> {
  const token = local.auth.token ?? local.sync.token;
  if (!token) return local;
  const payload = await readResponse<TeamStateResponse>(await fetch(apiUrl(local.sync.serverUrl, "/team/state"), {
    headers: authHeaders(token),
  }));
  const base = {
    ...createInitialState(),
    auth: local.auth,
    sync: {
      ...local.sync,
      enabled: false,
      autoSync: false,
      token,
      lastPulledRevision: 0,
      status: "idle" as const,
      message: "团队在线模式",
    },
  };
  const merged = mergeRowsIntoState(base, payload.changes, payload.current_revision, { forceRemote: true });
  const currentMember = currentMemberForAccount(merged);
  return {
    ...merged,
    currentMemberId: currentMember?.id ?? merged.currentMemberId,
    auth: local.auth,
    sync: {
      ...merged.sync,
      enabled: false,
      autoSync: false,
      token,
      serverUrl: local.sync.serverUrl,
      username: local.auth.account?.email ?? local.sync.username,
      status: "synced",
      message: "团队在线数据已加载",
      retryCount: 0,
      nextRetryAt: undefined,
      lastPulledRevision: payload.current_revision,
    },
  };
}

const rowKey = (row: { entity: string; id: string }) => `${row.entity}:${row.id}`;

export function teamChangesBetween(before: AppState, after: AppState): SyncRow[] {
  const beforeRows = new Map(flattenStateToChanges(before).map((row) => [rowKey(row), JSON.stringify(row)]));
  return flattenStateToChanges(after)
    .filter((row) => beforeRows.get(rowKey(row)) !== JSON.stringify(row))
    .map((row) => ({ ...row, revision: 0, version: 1 }));
}

export async function pushTeamChanges(sync: SyncState, token: string, before: AppState, after: AppState): Promise<number | undefined> {
  const changes = teamChangesBetween(before, after);
  if (changes.length === 0) return undefined;
  const payload = await readResponse<TeamChangeResponse>(await fetch(apiUrl(sync.serverUrl, "/team/changes"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      device_id: sync.deviceId,
      changes,
    }),
  }));
  return payload.current_revision;
}

export async function getTeamRevision(sync: SyncState, token: string): Promise<number> {
  const payload = await readResponse<TeamRevisionResponse>(await fetch(apiUrl(sync.serverUrl, "/team/revision"), {
    headers: authHeaders(token),
  }));
  return payload.current_revision;
}
