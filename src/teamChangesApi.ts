import { flattenStateToChanges } from "./syncStateSync";
import type { AppState, SyncState } from "./types";
import type { SyncRow } from "./syncPayloadTypes";
import { readTeamResponse, teamApiUrl, teamAuthHeaders } from "./teamApiHttp";

type TeamRevisionResponse = {
  current_revision: number;
};

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
  const payload = await readTeamResponse<TeamRevisionResponse>(await fetch(teamApiUrl(sync.serverUrl, "/team/changes"), {
    method: "POST",
    headers: teamAuthHeaders(token),
    body: JSON.stringify({
      device_id: sync.deviceId,
      changes,
    }),
  }));
  return payload.current_revision;
}

export async function getTeamRevision(sync: SyncState, token: string): Promise<number> {
  const payload = await readTeamResponse<TeamRevisionResponse>(await fetch(teamApiUrl(sync.serverUrl, "/team/revision"), {
    headers: teamAuthHeaders(token),
  }));
  return payload.current_revision;
}
