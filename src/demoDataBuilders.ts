import { todayKey } from "./seed";
import type { FocusSession, Task } from "./types";

const baseProjectId = "project_starter";

export const demoIsoAt = (offsetDays: number, hour: number, minute = 0) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
};

export const demoDateKey = (offsetDays: number) => todayKey(new Date(new Date().setDate(new Date().getDate() + offsetDays)));

export const makeDemoFocusSession = (
  id: string,
  taskId: string,
  offsetDays: number,
  hour: number,
  outcome: "completed" | "aborted" = "completed",
  internal = 0,
  external = 0,
): FocusSession => ({
  id,
  taskId,
  mode: "focus",
  duration: 25 * 60,
  startedAt: demoIsoAt(offsetDays, hour),
  endedAt: demoIsoAt(offsetDays, hour, outcome === "completed" ? 25 : 12),
  outcome,
  interruptionCounts: { internal, external },
});

export const makeDemoTask = (patch: Partial<Task> & Pick<Task, "id" | "title" | "project" | "estimatePomodoros" | "status">): Task => {
  const now = new Date().toISOString();
  return {
    notes: "",
    tags: [],
    projectId: baseProjectId,
    progressPercent: 0,
    progressNote: "",
    priority: "medium",
    severity: "medium",
    stage: "requirements",
    repeatRule: "none",
    subtasks: [],
    sortOrder: 100,
    actualPomodoros: 0,
    estimateHistory: [],
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
};
