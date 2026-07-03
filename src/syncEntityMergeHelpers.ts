import { singletonEntities, type SyncEntity, type SyncMergeRow, type SyncPayload } from "./syncEntityMergeTypes";

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const timestampFor = (_entity: SyncEntity, payload: unknown, fallback: string) => {
  if (!isObject(payload)) return fallback;
  const candidates = [
    "updatedAt",
    "reviewAcceptedAt",
    "reviewReturnedAt",
    "reviewSubmittedAt",
    "endedAt",
    "pausedAt",
    "startedAt",
    "createdAt",
    "completedAt",
  ];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return fallback;
};

const localTimestampFor = (entity: SyncEntity, value: SyncPayload, stateUpdatedAt: string) => {
  if (singletonEntities.includes(entity)) return stateUpdatedAt;
  return timestampFor(entity, value, stateUpdatedAt);
};

export const shouldAcceptRemote = (remote: SyncMergeRow, local?: SyncPayload, stateUpdatedAt = "", forceRemote = false) => {
  if (forceRemote) return true;
  if (!local) return true;
  return remote.updated_at >= localTimestampFor(remote.entity, local, stateUpdatedAt);
};

export const upsert = <T extends { id: string }>(entity: SyncEntity, items: T[], incoming: T, updatedAt: string, stateUpdatedAt: string, forceRemote = false) => {
  const existing = items.find((item) => item.id === incoming.id);
  if (!existing) return [incoming, ...items];
  return items.map((item) => (item.id === incoming.id && (forceRemote || updatedAt >= timestampFor(entity, item, stateUpdatedAt)) ? incoming : item));
};
