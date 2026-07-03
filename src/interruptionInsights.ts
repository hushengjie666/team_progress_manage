import type { AppState, InterruptionHotspot } from "./types";

export const interruptionHotspots = (state: AppState, limit = 3): InterruptionHotspot[] => {
  const buckets = new Map<number, { count: number; internal: number; external: number }>();
  for (const item of state.interruptions) {
    const hour = new Date(item.createdAt).getHours();
    if (Number.isNaN(hour)) continue;
    const bucket = buckets.get(hour) ?? { count: 0, internal: 0, external: 0 };
    bucket.count += 1;
    bucket[item.type] += 1;
    buckets.set(hour, bucket);
  }
  return Array.from(buckets.entries())
    .map(([hour, bucket]) => ({
      hour,
      ...bucket,
      label: `${hour.toString().padStart(2, "0")}:00-${((hour + 1) % 24).toString().padStart(2, "0")}:00`,
    }))
    .sort((left, right) => right.count - left.count || left.hour - right.hour)
    .slice(0, limit);
};
