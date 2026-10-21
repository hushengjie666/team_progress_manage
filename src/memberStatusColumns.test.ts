import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./test/fixtures";
import { memberStatusDailyPlan, memberStatusMember, memberStatusProject, memberStatusTask } from "./test/memberStatusFixtures";
import { buildMemberStatusModel, countMemberStatusTodayTasks } from "./memberStatusColumns";
import type { AppState, WorkSession } from "./types";

const date = "2026-06-30";
const timestamp = `${date}T09:00:00Z`;

const fixture = () => {
  const base = createInitialState();
  const projects = [memberStatusProject("project_a", "项目 A"), memberStatusProject("project_b", "项目 B")];
  const members = [
    memberStatusMember({ id: "member_a", projectId: "project_a", accountId: "account_a", name: "成员 A", roles: [] }),
    memberStatusMember({ id: "member_a_b", projectId: "project_b", accountId: "account_a", name: "成员 A", roles: [] }),
    memberStatusMember({ id: "member_b", projectId: "project_b", accountId: "account_b", name: "成员 B", email: "b@example.com", roles: [] }),
  ];
  return { ...base, projects, projectMembers: members, tasks: [], dailyPlans: [], workSessions: [] } as AppState;
};

const task = (id: string, overrides: Partial<AppState["tasks"][number]> = {}) => ({
  ...memberStatusTask({ id, projectId: "project_a", project: "项目 A", primaryExecutorMemberId: undefined }), ...overrides,
});

const session = (taskId: string, overrides: Partial<WorkSession> = {}): WorkSession => ({
  id: `session_${taskId}`, taskId, ownerAccountId: "account_a", focusSessionId: "focus_test",
  status: "ended", startedAt: timestamp, endedAt: `${date}T09:25:00Z`, totalPausedSeconds: 0,
  createdAt: timestamp, updatedAt: timestamp, ...overrides,
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("member today task reconciliation", () => {
  it("reconciles seven planned tasks and an unplanned completion despite missing member roles", () => {
    const state = fixture();
    state.tasks = [
      ...Array.from({ length: 5 }, (_, index) => task(`unassigned_${index}`, { status: "completed" })),
      task("assigned", { projectId: "project_b", primaryExecutorMemberId: "member_a_b", status: "completed" }),
      task("shared", { projectId: "project_b", primaryExecutorMemberId: "member_b", collaboratorMemberIds: ["member_a_b"], status: "completed" }),
      task("unplanned_completed", {
        status: "completed", completedAt: timestamp, reviewSubmittedAt: "2026-06-20T09:00:00Z",
        reviewSubmittedByMemberId: "member_a",
      }),
    ];
    state.dailyPlans = [{ ...memberStatusDailyPlan(state.tasks.slice(0, 7).map((item) => item.id)), date, ownerAccountId: "account_a" }];

    const model = buildMemberStatusModel(state, undefined, date);

    expect(model.taskCount).toBe(8);
    expect(model.columns.map((column) => [column.name, column.displayedTasks.length])).toEqual([["成员 A", 8], ["成员 B", 1]]);
    expect(new Set(model.columns.flatMap((column) => column.displayedTasks.map((item) => item.id))).size).toBe(model.taskCount);
    expect(model.columns[0].projectTaskGroups.every((group) => group.roleLabel === "成员")).toBe(true);
    expect(state.tasks.filter((item) => !item.primaryExecutorMemberId)).toHaveLength(6);
    expect(state.projectMembers.every((member) => member.roles.length === 0)).toBe(true);
  });

  it("counts running work outside a plan and resolves its owner when executor metadata is missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(timestamp));
    const state = fixture();
    state.tasks = [task("running", { status: "in_progress" })];
    state.workSessions = [session("running", {
      status: "active", endedAt: undefined, startedAt: "2026-06-29T08:00:00Z", pausedAt: "2026-06-29T09:00:00Z",
    })];

    const model = buildMemberStatusModel(state, undefined, date);

    expect(model.taskCount).toBe(1);
    expect(model.columns[0].runningTask?.id).toBe("running");
    expect(model.columns[0].displayedTasks.map((item) => item.id)).toEqual(["running"]);
  });

  it("resolves actual execution by executor before falling back to the session owner", () => {
    const state = fixture();
    state.tasks = [task("worked", { projectId: "project_b" })];
    state.workSessions = [session("worked", { executorMemberId: "member_b" })];
    const model = buildMemberStatusModel(state, undefined, date);
    expect(model.columns.map((column) => column.displayedTasks.length)).toEqual([0, 1]);
    expect(model.taskCount).toBe(1);
  });

  it("keeps unresolved assignments visible without assigning them to an unrelated project owner", () => {
    const state = fixture();
    state.projectMembers[1].roles = ["project_owner"];
    state.tasks = [task("legacy_unassigned"), task("stale_assignee", { primaryExecutorMemberId: "missing_member" })];
    state.dailyPlans = [{ ...memberStatusDailyPlan(state.tasks.map((item) => item.id)), date }];
    const model = buildMemberStatusModel(state, undefined, date);
    expect(model.taskCount).toBe(2);
    expect(model.columns.find((column) => column.name === "成员 A")?.displayedTasks).toHaveLength(0);
    expect(model.columns.find((column) => column.name === "归属待确认")?.displayedTasks).toHaveLength(2);
  });

  it("does not infer that the reviewer executed an unassigned completed task", () => {
    const state = fixture();
    state.tasks = [task("reviewed", { status: "completed", completedAt: timestamp, reviewAcceptedByMemberId: "member_a" })];
    const model = buildMemberStatusModel(state, undefined, date);
    expect(model.columns[0].displayedTasks).toHaveLength(0);
    expect(model.columns[model.columns.length - 1]?.name).toBe("归属待确认");
  });

  it("uses local calendar dates for completed work and excludes historical completions", () => {
    vi.stubEnv("TZ", "Asia/Shanghai");
    const state = fixture();
    state.tasks = [
      task("local_today", { status: "completed", completedAt: "2026-06-29T16:30:00Z", reviewSubmittedByMemberId: "member_a" }),
      task("local_yesterday", { status: "completed", completedAt: "2026-06-29T15:30:00Z" }),
    ];
    expect(buildMemberStatusModel(state, undefined, date).columns[0].displayedTasks.map((item) => item.id)).toEqual(["local_today"]);
    expect(countMemberStatusTodayTasks(state, undefined, date)).toBe(1);
  });

  it("scopes legacy combined plans by the task project and excludes other dates and deleted tasks", () => {
    const state = fixture();
    state.projects[0].workspaceId = "workspace_a";
    state.tasks = [task("wrong_workspace"), task("yesterday"), task("archived", { status: "archived" })];
    state.dailyPlans = [
      { ...memberStatusDailyPlan(["wrong_workspace"]), date, workspaceId: "workspace_b" },
      { ...memberStatusDailyPlan(["yesterday"]), date: "2026-06-29", workspaceId: "workspace_a" },
      { ...memberStatusDailyPlan(["missing_task", "archived"]), date, workspaceId: "workspace_a" },
    ];
    state.workSessions = [session("missing_task")];
    expect(buildMemberStatusModel(state, undefined, date, "workspace_a").taskCount).toBe(1);
    expect(buildMemberStatusModel(state, undefined, date, "workspace_b").taskCount).toBe(0);
  });

  it("deduplicates tasks appearing in multiple plans and respects the selected project", () => {
    const state = fixture();
    state.tasks = [task("task_a", { primaryExecutorMemberId: "member_a" }), task("task_b", { projectId: "project_b", primaryExecutorMemberId: "member_b" })];
    state.dailyPlans = [0, 1].map((index) => ({ ...memberStatusDailyPlan(["task_a", "task_b", "task_a"]), id: `plan_${index}`, date }));
    const model = buildMemberStatusModel(state, "project_a", date);
    expect(model.taskCount).toBe(1);
    expect(model.columns.flatMap((column) => column.displayedTasks.map((item) => item.id))).toEqual(["task_a"]);
  });
});
