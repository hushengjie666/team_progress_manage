import { todayKey } from "./seed";

export const nowIso = () => new Date().toISOString();
export const today = () => todayKey();
