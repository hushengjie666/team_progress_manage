import { describe, expect, it } from "vitest";
import { createTestState, withExecutionSignal, withWorkSession } from "./test/fixtures";
import type { ExecutionSignalType, WorkSession } from "./types";
import { weeklyFocusTrend } from "./weeklyFocusTrend";
import { finishWorkSessionInState } from "./workSessionFinish";

const day = "2026-04-02";
const base = createTestState();
const project = base.projects[0];
const account = { id: "mine", name: "本人", email: "me@example.test", createdAt: base.updatedAt, updatedAt: base.updatedAt };
const state = {
  ...base,
  auth: { ...base.auth, account },
  projectMembers: base.projectMembers.map((member) => ({ ...member, accountId: account.id })),
};
const start = "2026-03-31T23:30:00";
const end = "2026-04-01T01:00:00";
const session = (overrides: Partial<WorkSession> = {}) => withWorkSession(state, {
  startedAt: start, endedAt: end, totalPausedSeconds: 1800, ...overrides,
});
const signal = (type: ExecutionSignalType, createdAt: string) => ({ id: type, type, createdAt });

describe("personal seven-day work time", () => {
  it("splits the actual running intervals at local midnight even for an aborted, duplicate session", () => {
    let active = session({ status: "active", endedAt: undefined });
    for (const event of [
      signal("work_resumed", "2026-04-01T00:20:00"), signal("work_started", start),
      signal("work_paused", "2026-03-31T23:50:00"),
    ]) active = withExecutionSignal(active, event);
    expect(weeklyFocusTrend(active, null, day).hasHistory).toBe(false);
    const ended = finishWorkSessionInState(active, end, undefined, "work_fixture", { outcome: "aborted" });
    const trend = weeklyFocusTrend({ ...ended, workSessions: [...ended.workSessions, ...ended.workSessions],
      executionSignals: [...ended.executionSignals, ...ended.executionSignals] }, null, day);
    expect(trend.days.map((item) => item.seconds)).toEqual([0, 0, 0, 0, 1200, 2400, 0]);
    expect(trend.totalSeconds).toBe(3600);
    expect(trend.days[0].date).toBe("2026-03-27");
  });

  it("uses session boundaries with a complete set of pause and resume timestamps", () => {
    const paused = withExecutionSignal(session(), signal("work_paused", "2026-03-31T23:50:00"));
    const resumed = withExecutionSignal(paused, signal("work_resumed", "2026-04-01T00:20:00"));
    expect(weeklyFocusTrend(resumed, null, day).days.map((item) => item.seconds)).toEqual([0, 0, 0, 0, 1200, 2400, 0]);
  });

  it("stops at the final pause and clips at the first local midnight", () => {
    let paused = session({ totalPausedSeconds: 0 });
    for (const event of [signal("work_started", start), signal("work_paused", "2026-04-01T00:10:00"), signal("work_ended", end)]) {
      paused = withExecutionSignal(paused, event);
    }
    expect(weeklyFocusTrend(paused, null, "2026-04-07").days[0]).toEqual({ date: "2026-04-01", seconds: 600 });
    expect(weeklyFocusTrend(paused, null, "2026-04-08")).toMatchObject({ hasHistory: true, totalSeconds: 0 });
  });

  it("allocates legacy net seconds to the end date, including incomplete signal history", () => {
    const legacy = session({ ownerAccountId: undefined });
    const incomplete = withExecutionSignal(withExecutionSignal(legacy, signal("work_started", start)), signal("work_ended", end));
    for (const sample of [legacy, incomplete]) {
      expect(weeklyFocusTrend(sample, null, day).days.map((item) => item.seconds)).toEqual([0, 0, 0, 0, 0, 3600, 0]);
    }
  });

  it("sums subsecond records before formatting", () => {
    const first = session({ startedAt: "2026-04-02T01:00:00", endedAt: "2026-04-02T01:00:00.450", totalPausedSeconds: 0 });
    const next = withWorkSession(first, { ...first.workSessions[0], id: "another" });
    expect(weeklyFocusTrend(next, null, day).totalSeconds).toBe(1);
  });

  it("requires an accessible task, matching account or legacy executor, and a work phase", () => {
    const sample = session();
    const rest = { id: "focus_fixture", mode: "short_break" as const, duration: 300, startedAt: start,
      endedAt: end, interruptionCounts: { internal: 0, external: 0 } };
    for (const hidden of [
      session({ ownerAccountId: "other" }), session({ ownerAccountId: undefined, executorMemberId: "someone" }),
      { ...sample, projectMembers: [] }, { ...sample, focusSessions: [rest] }, { ...sample, auth: { ...sample.auth, account: undefined } },
    ]) expect(weeklyFocusTrend(hidden, null, day).hasHistory).toBe(false);
    expect(weeklyFocusTrend(sample, "elsewhere", day).hasHistory).toBe(false);
    expect(weeklyFocusTrend({ ...sample, projects: [{ ...project, workspaceId: "selected" }] }, "selected", day).hasHistory).toBe(true);
  });
});
