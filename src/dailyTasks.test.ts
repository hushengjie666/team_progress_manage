import { dailyTaskCache, restoreDailyTaskFields } from "./dailyTaskCache";
import { describe, expect, it } from "vitest";
import { createInitialState } from "./test/fixtures";
import { workbenchTodayPlan } from "./test/workbenchFixtures";
import { dailyTaskBelongsToAccount, dailyTaskForDate, withDailyTasks } from "./dailyTasks";
import { generateRecurringTask } from "./recurrence";
import { submitTaskForReviewInState } from "./taskReviewState";
import { localDateForTimestamp } from "./appClock";
import type { Task } from "./types";

function setup() {
  const state = createInitialState();
  const project = state.projects[0];
  const now = state.updatedAt;
  state.auth.account = { id: "me", name: "我", email: "me@example.test", workspaceId: "w", createdAt: now, updatedAt: now };
  state.auth.workspace = { id: "w", type: "shared", name: "团队", createdAt: now, updatedAt: now };
  project.workspaceId = "w";
  project.autoAcceptCompletedTasks = false;
  const member = state.projectMembers[0];
  member.accountId = "me";
  const task: Task = { ...state.tasks[0], isDaily: true, status: "pool", repeatRule: "daily", creatorMemberId: member.id };
  state.tasks = [task];
  return { state, task, member };
}

describe("日常任务", () => {
  it("uses project access and assignment before creator or personal ownership", () => {
    const { state, task, member } = setup();
    const belongs = (patch: Partial<Task>) => dailyTaskBelongsToAccount(state, { ...task, ...patch });
    expect(belongs({ primaryExecutorMemberId: member.id })).toBe(true);
    expect(belongs({ primaryExecutorMemberId: "other", collaboratorMemberIds: [member.id] })).toBe(true);
    expect(belongs({ primaryExecutorMemberId: "other" })).toBe(false);
    expect(belongs({ primaryExecutorMemberId: undefined })).toBe(true);
    expect(belongs({ primaryExecutorMemberId: undefined, creatorMemberId: "other" })).toBe(false);
    expect(belongs({ projectId: "hidden" })).toBe(false);
    state.auth.workspace = { ...state.auth.workspace!, type: "private", ownerAccountId: "me" };
    expect(belongs({ primaryExecutorMemberId: undefined, creatorMemberId: "other" })).toBe(true);
    expect(belongs({ status: "archived" })).toBe(false);
    expect(belongs({ status: "split" })).toBe(false);
  });

  it("excludes a removal only for its owner and local date, and stops when disabled", () => {
    const { state, task } = setup();
    task.dailyRemovedDates = { me: "2026-11-28" };
    const ids = (date: string) => withDailyTasks(state, workbenchTodayPlan([], { date })).committedTaskIds;
    expect(ids("2026-11-28")).toEqual([]);
    expect(ids("2026-11-29")).toEqual([task.id]);
    task.dailyRemovedDates = { other: "2026-11-29" };
    expect(ids("2026-11-29")).toEqual([task.id]);
    task.isDaily = false;
    expect(ids("2026-11-30")).toEqual([]);
  });

  it("records each local day once on the original task and skips recurrence and review", () => {
    const { state, task, member } = setup();
    const midnight = new Date(2026, 10, 28, 0, 1).toISOString();
    expect(localDateForTimestamp(midnight)).toBe("2026-11-28");
    const saved = submitTaskForReviewInState(state, task.id, member.id, midnight);
    expect(saved.tasks).toHaveLength(1);
    expect(saved.tasks[0].dailyCompletedDates).toEqual(["2026-11-28"]);
    expect(generateRecurringTask(saved.tasks[0], midnight)).toBeNull();
    expect(submitTaskForReviewInState(saved, task.id, member.id, midnight)).toBe(saved);
    expect(dailyTaskForDate(saved.tasks[0], "2026-11-28").status).toBe("completed");
    expect(dailyTaskForDate(saved.tasks[0], "2026-11-29").status).toBe("committed");
  });
});

it("restores local check-in fields only for the same account, backend and returned task revision", () => {
  const { state, task } = setup();
  state.auth.status = "authenticated";
  task.dailyCompletedDates = ["2026-11-28"];
  task.dailyRemovedDates = { me: "2026-11-29" };
  const cache = dailyTaskCache(state);
  const row = { ...task, isDaily: undefined, dailyCompletedDates: undefined, dailyRemovedDates: undefined };
  const restore = (tasks: Task[], account = "me") => restoreDailyTaskFields(tasks, cache, account, state.backend.serverUrl);
  expect(restore([row])[0]).toMatchObject({ isDaily: true, dailyCompletedDates: task.dailyCompletedDates, dailyRemovedDates: task.dailyRemovedDates });
  expect(restore([{ ...row, isDaily: false }])[0].isDaily).toBe(false);
  expect(restore([{ ...row, updatedAt: "later" }])[0].isDaily).toBeUndefined();
  expect(restore([row], "other")[0].isDaily).toBeUndefined();
  expect(restore([])).toEqual([]);
});
