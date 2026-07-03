import { describe, expect, it } from "vitest";
import { todayKey } from "../../seed";
import { createInitialState } from "../../test/fixtures";
import type { CalendarDaySummary, FocusSession, Interruption } from "../../types";
import { buildCalendarDayDetailModel, calendarReviewLabel } from "./calendarDayDetailModel";

const selectedDay = (overrides: Partial<CalendarDaySummary> = {}): CalendarDaySummary => ({
  date: todayKey(),
  committedTaskIds: [],
  completedPomodoros: 0,
  plannedPomodoros: 0,
  interruptionCount: 0,
  abortedPomodoros: 0,
  overdueTaskIds: [],
  reminderTaskIds: [],
  reviewed: false,
  ...overrides,
});

describe("calendar day detail model", () => {
  it("builds typed task groups and excludes committed or finished tasks from scheduling", () => {
    const state = createInitialState();
    const committed = { ...state.tasks[0], id: "task_committed", status: "committed" as const };
    const candidate = { ...state.tasks[1], id: "task_candidate", status: "pool" as const };
    const completed = { ...state.tasks[2], id: "task_completed", status: "completed" as const };
    const model = buildCalendarDayDetailModel({
      ...state,
      tasks: [committed, candidate, completed],
    }, selectedDay({
      committedTaskIds: [committed.id, "missing_task"],
      overdueTaskIds: [candidate.id],
      reminderTaskIds: [completed.id],
    }));

    expect(model.selectedTasks.map((task) => task.id)).toEqual([committed.id]);
    expect(model.overdueTasks.map((task) => task.id)).toEqual([candidate.id]);
    expect(model.reminderTasks.map((task) => task.id)).toEqual([completed.id]);
    expect(model.schedulableTasks.map((task) => task.id)).toEqual([candidate.id]);
  });

  it("filters sessions and interruptions to the selected date", () => {
    const state = createInitialState();
    const session: FocusSession = {
      id: "session_today",
      mode: "focus",
      duration: 1500,
      startedAt: `${todayKey()}T08:00:00.000Z`,
      endedAt: `${todayKey()}T08:25:00.000Z`,
      outcome: "completed",
      interruptionCounts: { internal: 1, external: 0 },
    };
    const oldSession = { ...session, id: "session_old", startedAt: "2026-01-01T08:00:00.000Z" };
    const interruption: Interruption = {
      id: "interrupt_today",
      type: "external",
      note: "消息",
      createdAt: `${todayKey()}T08:10:00.000Z`,
    };
    const oldInterruption = { ...interruption, id: "interrupt_old", createdAt: "2026-01-01T08:10:00.000Z" };
    const model = buildCalendarDayDetailModel({
      ...state,
      focusSessions: [session, oldSession],
      interruptions: [interruption, oldInterruption],
    }, selectedDay());

    expect(model.selectedSessions.map((item) => item.id)).toEqual(["session_today"]);
    expect(model.selectedInterruptions.map((item) => item.id)).toEqual(["interrupt_today"]);
  });

  it("labels review moods consistently", () => {
    expect(calendarReviewLabel({ mood: "low", wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" })).toBe("偏低");
    expect(calendarReviewLabel({ mood: "great", wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" })).toBe("优秀");
    expect(calendarReviewLabel()).toBe("未回顾");
  });
});
