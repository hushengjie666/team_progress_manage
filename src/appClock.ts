import { todayKey } from "./seed";

export const nowIso = () => new Date().toISOString();
export const today = () => todayKey();

export const localDateForTimestamp = (timestamp?: string) => {
  if (!timestamp) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) return timestamp;
  const value = new Date(timestamp);
  return Number.isFinite(value.getTime()) ? todayKey(value) : undefined;
};
