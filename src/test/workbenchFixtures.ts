import { todayKey } from "../seed";
import type { DailyPlan, Task } from "../types";

export const workbenchTimestamp = "2026-06-30T08:00:00.000Z";

export const workbenchTask = (id: string, status: Task["status"], sortOrder: number): Task => ({
  id,
  title: id,
  notes: "",
  tags: [],
  projectId: "project_starter",
  project: "TimeManage",
  collaboratorMemberIds: [],
  priority: "medium",
  severity: "medium",
  stage: "requirements",
  estimatePomodoros: 1,
  status,
  repeatRule: "none",
  subtasks: [],
  sortOrder,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: workbenchTimestamp,
  updatedAt: workbenchTimestamp,
});

const workbenchReview = (): DailyPlan["review"] => ({
  mood: "normal",
  wins: "",
  blockers: "",
  interruptionPattern: "",
  tomorrowFocus: "",
});

export const workbenchTodayPlan = (committedTaskIds: string[] = [], overrides: Partial<DailyPlan> = {}): DailyPlan => {
  const base: DailyPlan = {
    id: "plan_test_today",
    date: todayKey(),
    capacityPomodoros: 4,
    committedTaskIds,
    completedPomodoros: 0,
    suggestedTaskIds: [],
    reflection: "",
    review: workbenchReview(),
    createdAt: workbenchTimestamp,
    updatedAt: workbenchTimestamp,
  };

  return {
    ...base,
    ...overrides,
    committedTaskIds: overrides.committedTaskIds ?? committedTaskIds,
    review: overrides.review ?? workbenchReview(),
  };
};
