import { describe, expect, it } from "vitest";
import {
  buildInsights,
  coachSteps,
  deriveRewardState,
  estimateDeltaLabel,
  focusQuality,
  interruptionHotspots,
  nextActions,
  pauseTimer,
  planPressure,
  restoreTimer,
  resumeTimer,
  suggestedCapacity,
  taskSuggestions,
  computeStreak,
} from "./domain";
import { todayKey } from "./seed";
import { createInitialState, iso } from "./test/fixtures";
import {
  endSessionInState,
  ensureTodayPlan,
  finishExpiredTimerInState,
  getTodayPlan,
  removeTaskFromTodayInState,
  shouldFinishExpiredTimerInState,
  startTimerInState,
  toggleTimerInState,
} from "./appModel";
import { addTaskToTodayInState } from "./workSessionTransitions";
import { buildCsvBundle, createBackupSnapshot, mergeImportedState, summarizeImportPayload } from "./dataPortability";
import { calendarSummaries, filteredStateForReport, instantiateTemplate, parseQuickInput, reviewSummary } from "./planning";
import { normalizeAppStatePayload } from "./storage";
import { mergeRowsIntoState, type SyncRow } from "./sync";
import {
  acceptTaskInState,
  addProjectMemberToState,
  assignTaskInState,
  createProjectInState,
  deleteTeamMemberInState,
  reorderProjectsInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
  updateProjectMemberInState,
  updateTeamMemberInState,
  updateTaskProgressInState,
} from "./teamProgress";
import { buildProjectOverviewTaskBoard, createProjectTaskInState, deriveProjectDetailModel, filterProjectTasks, projectAccessForCurrentMember, projectTasksForProject } from "./projectDetail";
import { resolveMemberIdForProject } from "./memberIdentity";
import {
  buildMyProjectTaskCards,
  buildProjectOverviewCards,
  filterTodayCommittedTasksForMember,
  filterMyTasksByProjectSelection,
  quickAddProjectIdForSelection,
} from "./projectOverview";
import { bindAccountToMembers } from "./authModel";
import type { ActiveTimer, AppState, FocusSession, ProjectMember, Task, TaskTemplate } from "./types";

describe("planning and rewards", () => {
  it("reduces suggested capacity after a high interruption day", () => {
    const state = createInitialState();
    const today = todayKey();
    const next: AppState = {
      ...state,
      dailyPlans: [
        ...state.dailyPlans,
        ...Array.from({ length: 7 }, (_, index) => ({
          ...state.dailyPlans[0],
          id: `history_${index}`,
          date: todayKey(new Date(Date.UTC(2026, 4, index + 1))),
          completedPomodoros: 6,
        })),
      ],
      interruptions: Array.from({ length: 4 }, (_, index) => ({
        id: `interrupt_${index}`,
        type: "internal" as const,
        action: "defer" as const,
        note: "想刷消息",
        createdAt: `${today}T10:0${index}:00.000Z`,
      })),
    };
    expect(suggestedCapacity(next, today)).toBeLessThanOrEqual(5);
  });

  it("earns focus, review and streak badges from state", () => {
    const state = createInitialState();
    const session: FocusSession = {
      id: "session_done",
      taskId: state.tasks[0].id,
      mode: "focus",
      duration: 1500,
      startedAt: `${todayKey()}T08:00:00.000Z`,
      endedAt: `${todayKey()}T08:25:00.000Z`,
      outcome: "completed",
      interruptionCounts: { internal: 0, external: 0 },
    };
    const next = {
      ...state,
      focusSessions: [session],
      dailyPlans: state.dailyPlans.map((plan) => ({ ...plan, completedPomodoros: state.rewardState.dailyGoal, reviewedAt: `${todayKey()}T21:00:00.000Z` })),
    };
    const reward = deriveRewardState(next);
    expect(reward.streak).toBeGreaterThanOrEqual(1);
    expect(reward.badges).toContain("首个番茄");
    expect(reward.badges).toContain("完成日终回顾");
  });

  it("builds actionable insights", () => {
    const state = createInitialState();
    const insights = buildInsights(state);
    expect(insights.some((item) => item.kind === "capacity")).toBe(true);
    expect(insights.some((item) => item.kind === "commitment")).toBe(true);
  });

  it("calculates coach steps from current progress", () => {
    const state = createInitialState();
    const steps = coachSteps(state);
    expect(steps.find((step) => step.id === "create_task")?.completed).toBe(true);
    expect(steps.find((step) => step.id === "commit_task")?.completed).toBe(true);
    expect(steps.find((step) => step.id === "start_focus")?.completed).toBe(false);
  });

  it("scores plan pressure and task suggestions", () => {
    const state = createInitialState();
    const pressure = planPressure(state, state.dailyPlans[0]);
    expect(pressure.level).toBe("light");
    const suggestions = taskSuggestions(state);
    expect(suggestions.some((item) => item.action === "split")).toBe(true);
    expect(suggestions[0].score).toBeGreaterThanOrEqual(suggestions[suggestions.length - 1]?.score ?? 0);
  });

  it("formats estimate deltas for humans", () => {
    expect(estimateDeltaLabel(3, 5)).toBe("低估 2 个番茄");
    expect(estimateDeltaLabel(5, 3)).toBe("高估 2 个番茄");
    expect(estimateDeltaLabel(4, 4)).toBe("估算准确");
  });

  it("does not reset streak while today is still in progress", () => {
    const state = createInitialState();
    const yesterday = todayKey(new Date(Date.now() - 86_400_000));
    const next: AppState = {
      ...state,
      dailyPlans: [
        { ...state.dailyPlans[0], completedPomodoros: 1 },
        { ...state.dailyPlans[0], id: "yesterday", date: yesterday, completedPomodoros: state.rewardState.dailyGoal },
      ],
    };
    expect(computeStreak(next)).toBe(1);
  });

  it("summarizes focus quality, interruption hotspots, and next actions", () => {
    const state = createInitialState();
    const today = todayKey();
    const next: AppState = {
      ...state,
      interruptions: [
        { id: "i1", type: "internal", action: "defer", note: "想刷消息", createdAt: `${today}T10:05:00.000+08:00` },
        { id: "i2", type: "external", action: "inbox", note: "临时会议", createdAt: `${today}T10:25:00.000+08:00` },
      ],
    };
    expect(focusQuality(next, today).score).toBeLessThan(100);
    expect(interruptionHotspots(next)[0]).toMatchObject({ hour: 10, count: 2, internal: 1, external: 1 });
    expect(nextActions(next, today).some((item) => item.id === "clear_inbox")).toBe(true);
  });
});

describe("data portability and long planning", () => {
  it("restores archived split parents as visible split tasks during normalization", () => {
    const state = createInitialState();
    const parent = {
      ...state.tasks[0],
      id: "legacy_split_parent",
      title: "旧拆分主任务",
      status: "archived" as const,
      projectId: state.projects[0].id,
    };
    const child = {
      ...state.tasks[1],
      id: "legacy_split_child",
      title: "旧拆分主任务 1",
      notes: "由「旧拆分主任务」拆分而来。",
      projectId: state.projects[0].id,
    };

    const normalized = normalizeAppStatePayload({ ...state, tasks: [parent, child] });

    expect(normalized.tasks.find((task) => task.id === "legacy_split_parent")?.status).toBe("split");
  });

  it("returns only one project's tasks and includes archived tasks by default", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_second`,
    );
    const withFirstTask = createProjectTaskInState(
      withSecondProject,
      firstProjectId,
      { title: "当前项目归档任务" },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_first`,
    );
    const withArchivedFirstTask = {
      ...withFirstTask,
      tasks: withFirstTask.tasks.map((task) =>
        task.id === "task_first" ? { ...task, status: "archived" as const } : task,
      ),
    };
    const withOtherTask = createProjectTaskInState(
      withArchivedFirstTask,
      "project_second",
      { title: "其他项目任务" },
      "2026-05-10T11:00:00.000Z",
      (prefix) => `${prefix}_other`,
    );

    const tasks = projectTasksForProject(withOtherTask, firstProjectId);

    expect(tasks.every((task) => task.projectId === firstProjectId)).toBe(true);
    expect(tasks.some((task) => task.title === "当前项目归档任务" && task.status === "archived")).toBe(true);
    expect(tasks.some((task) => task.title === "其他项目任务")).toBe(false);
  });

  it("creates project detail tasks in the current project", () => {
    const state = createInitialState();
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      { title: "项目详情页新任务", estimatePomodoros: 3 },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_detail`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_detail",
      title: "项目详情页新任务",
      projectId: project.id,
      project: project.name,
      estimatePomodoros: 3,
      status: "pool",
    });
  });

  it("converts project detail estimate hours to pomodoros when creating tasks", () => {
    const baseState = createInitialState();
    const state = { ...baseState, settings: { ...baseState.settings, focusMinutes: 25 } };
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      { title: "小时估算任务", estimateHours: 1 },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_hours`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_hours",
      title: "小时估算任务",
      estimatePomodoros: 3,
    });
  });

  it("creates project detail tasks with full planning and collaboration fields", () => {
    const state = createInitialState();
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      {
        title: "完整字段任务",
        notes: "补充说明",
        tags: ["需求", "前端"],
        priority: "high",
        severity: "very_high",
        stage: "development",
        estimatePomodoros: 5,
        primaryExecutorMemberId: "member_owner",
        collaboratorMemberIds: ["member_executor", "member_owner"],
        expectedStartAt: "2026-05-10T10:00:00.000Z",
        expectedFinishAt: "2026-05-11T10:00:00.000Z",
        dueAt: "2026-05-12T10:00:00.000Z",
        reminderAt: "2026-05-12T09:00:00.000Z",
        repeatRule: "interval",
        repeatIntervalDays: 3,
        subtasks: ["拆第一步", "拆第二步"],
      },
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_full`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_full",
      title: "完整字段任务",
      notes: "补充说明",
      tags: ["需求", "前端"],
      priority: "high",
      severity: "very_high",
      stage: "development",
      estimatePomodoros: 5,
      primaryExecutorMemberId: "member_owner",
      collaboratorMemberIds: ["member_executor"],
      expectedStartAt: "2026-05-10T10:00:00.000Z",
      expectedFinishAt: "2026-05-11T10:00:00.000Z",
      dueAt: "2026-05-12T10:00:00.000Z",
      reminderAt: "2026-05-12T09:00:00.000Z",
      repeatRule: "interval",
      repeatIntervalDays: 3,
    });
    expect(next.tasks[0].subtasks.map((subtask) => subtask.title)).toEqual(["拆第一步", "拆第二步"]);
  });

  it("allows every account to view and manage project workspaces", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const ownerAccess = projectAccessForCurrentMember(state, projectId);
    const withMember = addProjectMemberToState(
      state,
      projectId,
      "普通成员",
      "member@example.com",
      ["executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_member`,
    );
    const memberAccess = projectAccessForCurrentMember({ ...withMember, currentMemberId: "member_member" }, projectId);
    const nonMemberAccess = projectAccessForCurrentMember({ ...withMember, currentMemberId: "missing_member" }, projectId);
    const withSecondProject = createProjectInState(
      state,
      "同账号项目",
      "",
      "2026-05-10T11:00:00.000Z",
      (prefix) => `${prefix}_account`,
    );
    const accountScopedState: AppState = {
      ...withSecondProject,
      auth: {
        ...withSecondProject.auth,
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      },
      projectMembers: withSecondProject.projectMembers.map((member) =>
        member.projectId === "project_account" ? { ...member, accountId: "account_owner" } : member,
      ),
    };
    const accountAccess = projectAccessForCurrentMember(accountScopedState, "project_account");
    const emailScopedState: AppState = {
      ...accountScopedState,
      projectMembers: accountScopedState.projectMembers.map((member) =>
        member.projectId === "project_account" ? { ...member, accountId: undefined, teamMemberId: undefined, email: "owner@example.com" } : member,
      ),
    };
    const emailAccess = projectAccessForCurrentMember(emailScopedState, "project_account");

    expect(ownerAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(memberAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(nonMemberAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(accountAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(emailAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
  });

  it("creates projects with a project owner who can also execute work", () => {
    const state = createInitialState();
    const next = createProjectInState(
      state,
      "客户交付项目",
      "跟进客户上线",
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_test`,
    );
    expect(next.projects[0]).toMatchObject({
      id: "project_test",
      name: "客户交付项目",
      defaultExpectedStartHours: 24,
    });
    expect(next.projectMembers[0]).toMatchObject({
      id: "member_test",
      projectId: "project_test",
      roles: ["project_owner", "executor"],
    });
  });

  it("adds and updates project members with project-scoped roles", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withMember = addProjectMemberToState(
      state,
      projectId,
      "张三",
      "zhangsan@example.com",
      ["executor", "project_owner", "executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_zhangsan`,
    );
    expect(withMember.projectMembers[0]).toMatchObject({
      id: "member_zhangsan",
      projectId,
      name: "张三",
      roles: ["executor", "project_owner"],
    });
    const updated = updateProjectMemberInState(
      withMember,
      { ...withMember.projectMembers[0], roles: [] },
      "2026-05-10T11:00:00.000Z",
    );
    expect(updated.projectMembers[0].roles).toEqual(["executor"]);
  });

  it("updates team member profile data across project bindings", () => {
    const state = createInitialState();
    const teamMember = state.teamMembers[0];
    const updated = updateTeamMemberInState(
      state,
      { ...teamMember, name: "负责人 A", email: "owner-a@example.com" },
      "2026-05-10T11:00:00.000Z",
    );

    expect(updated.teamMembers.find((member) => member.id === teamMember.id)).toMatchObject({
      name: "负责人 A",
      email: "owner-a@example.com",
      updatedAt: "2026-05-10T11:00:00.000Z",
    });
    expect(updated.projectMembers.filter((member) => member.teamMemberId === teamMember.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "负责人 A",
          email: "owner-a@example.com",
          updatedAt: "2026-05-10T11:00:00.000Z",
        }),
      ]),
    );
    expect(updated.updatedAt).toBe("2026-05-10T11:00:00.000Z");
  });

  it("deletes a team member and clears project task assignments", () => {
    const state = createInitialState();
    const deleted = deleteTeamMemberInState(state, "team_member_owner", "2026-05-10T11:00:00.000Z");

    expect(deleted.teamMembers.some((member) => member.id === "team_member_owner")).toBe(false);
    expect(deleted.projectMembers.some((member) => member.teamMemberId === "team_member_owner")).toBe(false);
    expect(deleted.tasks[0]).toMatchObject({
      creatorMemberId: undefined,
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      updatedAt: "2026-05-10T11:00:00.000Z",
    });
    expect(deleted.sync.tombstones).toEqual(
      expect.arrayContaining([
        { entity: "team_member", id: "team_member_owner", deletedAt: "2026-05-10T11:00:00.000Z" },
        { entity: "project_member", id: "member_owner", deletedAt: "2026-05-10T11:00:00.000Z" },
      ]),
    );
  });

  it("assigns a task to one primary executor and keeps collaborators separate", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withMembers = addProjectMemberToState(
      addProjectMemberToState(
        state,
        projectId,
        "张三",
        "",
        ["executor"],
        "2026-05-10T10:00:00.000Z",
        (prefix) => `${prefix}_zhangsan`,
      ),
      projectId,
      "李四",
      "",
      ["executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_lisi`,
    );
    const assigned = assignTaskInState(withMembers, withMembers.tasks[0].id, {
      primaryExecutorMemberId: "member_zhangsan",
      collaboratorMemberIds: ["member_zhangsan", "member_lisi"],
    }, "2026-05-10T11:00:00.000Z");
    expect(assigned.tasks[0].primaryExecutorMemberId).toBe("member_zhangsan");
    expect(assigned.tasks[0].collaboratorMemberIds).toEqual(["member_lisi"]);

    const reassigned = assignTaskInState(assigned, assigned.tasks[0].id, {
      primaryExecutorMemberId: "member_lisi",
      collaboratorMemberIds: ["member_zhangsan", "member_lisi"],
    }, "2026-05-10T12:00:00.000Z");
    expect(reassigned.tasks[0].primaryExecutorMemberId).toBe("member_lisi");
    expect(reassigned.tasks[0].collaboratorMemberIds).toEqual(["member_zhangsan"]);
  });

  it("leaves a task unassigned when the selected member is not an executor", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withOwnerOnly = addProjectMemberToState(
      state,
      projectId,
      "只负责验收的人",
      "",
      ["project_owner"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_owner_only`,
    );
    const assigned = assignTaskInState(withOwnerOnly, withOwnerOnly.tasks[0].id, {
      primaryExecutorMemberId: "member_owner_only",
      collaboratorMemberIds: ["member_owner_only"],
    });
    expect(assigned.tasks[0].primaryExecutorMemberId).toBeUndefined();
    expect(assigned.tasks[0].collaboratorMemberIds).toEqual(["member_owner_only"]);
  });

  it("updates task progress with bounded percent and a manual progress note", () => {
    const state = createInitialState();
    const updated = updateTaskProgressInState(
      state,
      state.tasks[0].id,
      140,
      "完成接口联调，剩余验收清单。",
      "2026-05-10T11:00:00.000Z",
    );
    expect(updated.tasks[0]).toMatchObject({
      progressPercent: 100,
      progressNote: "完成接口联调，剩余验收清单。",
      updatedAt: "2026-05-10T11:00:00.000Z",
    });

    const reset = updateTaskProgressInState(updated, updated.tasks[0].id, -20, "", "2026-05-10T12:00:00.000Z");
    expect(reset.tasks[0]).toMatchObject({ progressPercent: 0, progressNote: "" });
  });

  it("submits a task for review before it can be accepted as completed", () => {
    const state = createInitialState();
    const inProgressState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "in_progress" as const } : task) };
    const submitted = submitTaskForReviewInState(
      inProgressState,
      state.tasks[0].id,
      "member_owner",
      "2026-05-10T10:00:00.000Z",
    );
    expect(submitted.tasks[0]).toMatchObject({
      status: "pending_review",
      progressPercent: 100,
      reviewSubmittedAt: "2026-05-10T10:00:00.000Z",
      reviewSubmittedByMemberId: "member_owner",
    });
    expect(submitted.tasks[0].completedAt).toBeUndefined();

    const accepted = acceptTaskInState(
      submitted,
      submitted.tasks[0].id,
      "member_owner",
      "2026-05-10T11:00:00.000Z",
    );
    expect(accepted.tasks[0]).toMatchObject({
      status: "completed",
      completedAt: "2026-05-10T11:00:00.000Z",
      reviewAcceptedAt: "2026-05-10T11:00:00.000Z",
      reviewAcceptedByMemberId: "member_owner",
    });
    expect(accepted.tasks[0].estimateHistory).toHaveLength(1);
  });

  it("creates and reviews tasks with the authenticated project member when currentMemberId is stale", () => {
    const state = createInitialState();
    const owner = state.projectMembers[0];
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      teamMemberId: "team_member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const loggedInState: AppState = {
      ...state,
      currentMemberId: teammate.id,
      auth: {
        ...state.auth,
        status: "authenticated",
        account: {
          id: owner.accountId!,
          workspaceId: "workspace_test",
          name: owner.name,
          email: owner.email!,
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      projectMembers: [teammate, owner],
    };
    const actorMemberId = resolveMemberIdForProject(loggedInState, owner.projectId);
    const created = createProjectTaskInState(
      loggedInState,
      owner.projectId,
      { title: "登录人创建的任务" },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_identity_create`,
    );
    const taskId = created.tasks[0].id;
    const committed = {
      ...created,
      tasks: created.tasks.map((task) => (task.id === taskId ? { ...task, status: "in_progress" as const } : task)),
    };
    const submitted = submitTaskForReviewInState(committed, taskId, actorMemberId, "2026-05-10T11:00:00.000Z");
    const accepted = acceptTaskInState(submitted, taskId, actorMemberId, "2026-05-10T12:00:00.000Z");

    expect(created.tasks[0].creatorMemberId).toBe(owner.id);
    expect(submitted.tasks[0].reviewSubmittedByMemberId).toBe(owner.id);
    expect(accepted.tasks[0].reviewAcceptedByMemberId).toBe(owner.id);
  });

  it("does not resubmit tasks already waiting for review", () => {
    const state = createInitialState();
    const inProgressState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "in_progress" as const } : task) };
    const submitted = submitTaskForReviewInState(
      inProgressState,
      state.tasks[0].id,
      "member_owner",
      "2026-05-10T10:00:00.000Z",
    );
    const resubmitted = submitTaskForReviewInState(
      submitted,
      state.tasks[0].id,
      "member_other",
      "2026-05-10T11:00:00.000Z",
    );

    expect(resubmitted.tasks[0]).toMatchObject({
      status: "pending_review",
      reviewSubmittedAt: "2026-05-10T10:00:00.000Z",
      reviewSubmittedByMemberId: "member_owner",
      updatedAt: "2026-05-10T10:00:00.000Z",
    });
  });

  it("does not start a timer for tasks waiting for review", () => {
    const state = createInitialState();
    const pendingReviewState = {
      ...state,
      tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "pending_review" as const } : task),
    };

    const started = startTimerInState(
      pendingReviewState,
      "focus",
      state.tasks[0].id,
      "2026-05-10T10:00:00.000Z",
      undefined,
      "session_pending_review",
    );

    expect(started.activeTimer).toBeUndefined();
    expect(started.tasks[0].status).toBe("pending_review");
    expect(started.workSessions).toHaveLength(0);
  });

  it("claims unassigned tasks for the authenticated account instead of a stale current member", () => {
    const state = createInitialState();
    const owner = state.projectMembers[0];
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      teamMemberId: "team_member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const taskId = state.tasks[0].id;
    const loggedInState: AppState = {
      ...state,
      currentMemberId: teammate.id,
      auth: {
        ...state.auth,
        status: "authenticated",
        account: {
          id: owner.accountId!,
          workspaceId: "workspace_test",
          name: owner.name,
          email: owner.email!,
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      projectMembers: [teammate, owner],
      tasks: state.tasks.map((task, index) =>
        index === 0
          ? { ...task, primaryExecutorMemberId: undefined, collaboratorMemberIds: [], status: "pool" as const }
          : task,
      ),
    };

    const started = startTimerInState(
      loggedInState,
      "focus",
      taskId,
      "2026-05-10T10:00:00.000Z",
      undefined,
      "session_identity_claim",
    );

    expect(started.tasks.find((task) => task.id === taskId)?.primaryExecutorMemberId).toBe(owner.id);
    expect(started.workSessions.find((session) => session.taskId === taskId)?.executorMemberId).toBe(owner.id);
  });

  it("ends active work when submitting an in-progress task for review", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T10:00:00.000Z",
      undefined,
      "session_review_submit",
    );
    const workSessionId = started.activeTimer?.workSessionId;

    const submitted = submitTaskForReviewInState(
      started,
      taskId,
      "member_owner",
      "2026-05-10T10:05:00.000Z",
    );

    expect(submitted.tasks.find((task) => task.id === taskId)).toMatchObject({
      status: "pending_review",
      progressPercent: 100,
      reviewSubmittedAt: "2026-05-10T10:05:00.000Z",
    });
    expect(submitted.activeTimer).toBeUndefined();
    expect(submitted.workSessions.find((session) => session.id === workSessionId)).toMatchObject({
      status: "ended",
      endedAt: "2026-05-10T10:05:00.000Z",
    });
    expect(submitted.focusSessions.find((session) => session.id === "session_review_submit")).toMatchObject({
      endedAt: "2026-05-10T10:05:00.000Z",
      outcome: "skipped",
    });
  });

  it("only submits committed or in-progress tasks for review", () => {
    const state = createInitialState();
    const poolState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "pool" as const } : task) };
    const poolAttempt = submitTaskForReviewInState(poolState, state.tasks[0].id, "member_owner", "2026-05-10T10:00:00.000Z");
    const committedState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "committed" as const } : task) };
    const committedAttempt = submitTaskForReviewInState(committedState, state.tasks[0].id, "member_owner", "2026-05-10T10:00:00.000Z");

    expect(poolAttempt.tasks[0].status).toBe("pool");
    expect(committedAttempt.tasks[0].status).toBe("pending_review");
  });

  it("returns a pending review task with a reason", () => {
    const state = createInitialState();
    const inProgressState = { ...state, tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: "in_progress" as const } : task) };
    const submitted = submitTaskForReviewInState(inProgressState, state.tasks[0].id, "member_owner", "2026-05-10T10:00:00.000Z");
    const returned = returnTaskForReviewInState(
      submitted,
      submitted.tasks[0].id,
      "验收口径缺少异常场景。",
      "member_owner",
      "2026-05-10T11:00:00.000Z",
    );
    expect(returned.tasks[0]).toMatchObject({
      status: "in_progress",
      progressPercent: 99,
      reviewReturnedAt: "2026-05-10T11:00:00.000Z",
      reviewReturnedByMemberId: "member_owner",
      reviewReturnReason: "验收口径缺少异常场景。",
    });
    expect(returned.tasks[0].completedAt).toBeUndefined();
  });

  it("migrates legacy personal task data into a starter project", () => {
    const legacy = {
      version: 1,
      tasks: [
        {
          id: "legacy_task",
          title: "旧任务",
          notes: "",
          tags: [],
          project: "旧项目标签",
          priority: "medium" as const,
          severity: "medium" as const,
          estimatePomodoros: 1,
          status: "pool" as const,
          subtasks: [],
          sortOrder: 10,
          actualPomodoros: 0,
          estimateHistory: [],
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
    };
    const migrated = normalizeAppStatePayload(legacy);
    expect(migrated.projects[0]).toMatchObject({ id: "project_starter" });
    expect(migrated.projectMembers[0].roles).toEqual(["project_owner", "executor"]);
    expect(migrated.currentMemberId).toBe(migrated.projectMembers[0].id);
    expect(migrated.tasks[0]).toMatchObject({
      id: "legacy_task",
      project: "旧项目标签",
      projectId: migrated.projects[0].id,
      collaboratorMemberIds: [],
      progressPercent: 0,
      progressNote: "",
    });
  });

  it("normalizes imported data into team progress state", () => {
    const state = createInitialState();
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");
    const imported = mergeImportedState(
      state,
      {
        version: 1,
        tasks: [
          {
            ...state.tasks[0],
            id: "imported_legacy_task",
            projectId: undefined,
            progressPercent: 150,
            progressNote: "导入前已经完成大部分。",
          },
        ],
      },
      backup,
    );
    expect(imported.projects.length).toBeGreaterThan(0);
    expect(imported.tasks[0].projectId).toBe(imported.projects[0].id);
    expect(imported.tasks[0].progressPercent).toBe(100);
    expect(imported.tasks[0].progressNote).toBe("导入前已经完成大部分。");
    expect(imported.backupSnapshots[0]).toMatchObject({ reason: "before_import" });
  });

  it("deduplicates team members by login identity during normalization", () => {
    const state = createInitialState();
    const normalized = normalizeAppStatePayload({
      ...state,
      teamMembers: [
        { ...state.teamMembers[0], id: "team_member_bound", email: "owner@example.com", updatedAt: "2026-05-10T10:00:00.000Z" },
        { ...state.teamMembers[0], id: "team_member_duplicate", email: "owner@example.com", updatedAt: "2026-05-10T11:00:00.000Z" },
      ],
      projectMembers: state.projectMembers.map((member) => ({ ...member, teamMemberId: "team_member_bound" })),
    });

    expect(normalized.teamMembers.filter((member) => member.email === "owner@example.com")).toHaveLength(1);
    expect(normalized.projectMembers[0].teamMemberId).toBe("team_member_bound");
  });

  it("reenables automatic sync when normalizing an authenticated team state", () => {
    const state = createInitialState();
    const normalized = normalizeAppStatePayload({
      ...state,
      auth: {
        status: "authenticated",
        token: "stored_auth_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_wangshuo",
          workspaceId: "workspace_test",
          name: "王硕",
          email: "wangshuo@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      sync: {
        ...state.sync,
        enabled: false,
        autoSync: false,
        token: undefined,
      },
    });

    expect(normalized.sync.enabled).toBe(true);
    expect(normalized.sync.autoSync).toBe(true);
    expect(normalized.sync.token).toBe("stored_auth_token");
  });

  it("deduplicates project member bindings for the same project and login identity", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const normalized = normalizeAppStatePayload({
      ...state,
      teamMembers: [
        {
          ...state.teamMembers[0],
          id: "team_member_wangshuo",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
      projectMembers: [
        {
          ...state.projectMembers[0],
          id: "member_wangshuo_old",
          projectId,
          teamMemberId: "team_member_wangshuo",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          roles: ["project_owner", "executor"],
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
        {
          ...state.projectMembers[0],
          id: "member_wangshuo_latest",
          projectId,
          teamMemberId: "team_member_wangshuo",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          roles: ["executor"],
          updatedAt: "2026-05-10T11:00:00.000Z",
        },
      ],
    });

    expect(normalized.projectMembers.filter((member) => member.teamMemberId === "team_member_wangshuo")).toHaveLength(1);
    expect(normalized.projectMembers[0]).toMatchObject({ id: "member_wangshuo_latest", roles: ["executor"] });
  });

  it("defaults legacy tasks without a stage to requirements", () => {
    const state = createInitialState();
    const legacyTask = { ...state.tasks[0] };
    delete (legacyTask as Partial<typeof legacyTask>).stage;
    const normalized = normalizeAppStatePayload({ ...state, tasks: [legacyTask] });

    expect(normalized.tasks[0].stage).toBe("requirements");
  });

  it("does not transfer project owner role when repairing duplicated login identities", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const normalized = normalizeAppStatePayload({
      ...state,
      auth: {
        ...state.auth,
        account: {
          id: "account_wangshuo",
          workspaceId: "workspace_test",
          name: "王硕",
          email: "wangshuo",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      },
      teamMembers: [
        {
          id: "team_member_account_owner",
          accountId: "account_owner",
          name: "王硕",
          email: "wangshuo",
          status: "active",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
        {
          id: "team_member_wangshuo",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          status: "active",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
      projectMembers: [
        {
          id: "member_stale_owner",
          projectId,
          teamMemberId: "team_member_account_owner",
          accountId: "account_owner",
          name: "王硕",
          email: "wangshuo",
          roles: ["project_owner", "executor"],
          status: "active",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      ],
    });

    expect(normalized.teamMembers.filter((member) => member.email === "wangshuo")).toHaveLength(1);
    expect(normalized.teamMembers[0]).toMatchObject({ id: "team_member_wangshuo", accountId: "account_wangshuo" });
    expect(normalized.projectMembers[0]).toMatchObject({
      teamMemberId: "team_member_wangshuo",
      accountId: "account_wangshuo",
      roles: ["executor"],
    });
  });

  it("summarizes imports, creates backups, and exports CSV", () => {
    const state = createInitialState();
    const summary = summarizeImportPayload(state);
    expect(summary.valid).toBe(true);
    expect(summary.taskCount).toBe(state.tasks.length);
    expect(buildCsvBundle(state)).toContain("# tasks.csv");
    const backup = createBackupSnapshot(state, "before_import", "2026-05-10T10:00:00.000Z");
    expect(backup.payload).toContain("project_starter");
    const imported = mergeImportedState(state, { ...state, tasks: [] }, backup);
    expect(imported.tasks).toHaveLength(0);
    expect(imported.backupSnapshots[0]).toMatchObject({ reason: "before_import" });
  });

  it("keeps newer local daily plan committed tasks when remote sync is older", () => {
    const state = createInitialState();
    const localPlan = {
      ...getTodayPlan(state),
      id: "plan_sync_today",
      date: "2026-05-10",
      committedTaskIds: [],
      updatedAt: "2026-05-10T12:00:00.000Z",
    };
    const remotePlan = {
      ...localPlan,
      committedTaskIds: ["task_write_prd"],
      updatedAt: "2026-05-10T09:00:00.000Z",
    };
    const row: SyncRow = {
      entity: "daily_plan",
      id: localPlan.id,
      device_id: "other_browser",
      updated_at: remotePlan.updatedAt,
      payload: remotePlan,
      revision: 12,
      version: 1,
    };

    const merged = mergeRowsIntoState({ ...state, dailyPlans: [localPlan] }, [row], 12);

    expect(merged.dailyPlans[0].committedTaskIds).toEqual([]);
  });

  it("builds calendar summaries and template tasks", () => {
    const state = createInitialState();
    const todayPlan = { ...getTodayPlan(state), committedTaskIds: ["task_calendar_test"] };
    const summaries = calendarSummaries({ ...state, dailyPlans: [todayPlan] }, todayPlan.date, 7);
    expect(summaries).toHaveLength(7);
    expect(summaries[0].committedTaskIds.length).toBeGreaterThan(0);
    expect(summaries[0].review).toBeTruthy();
    const template: TaskTemplate = {
      id: "template_test",
      name: "测试模板",
      description: "模板说明",
      project: "测试",
      tags: ["模板"],
      priority: "high",
      severity: "medium",
      estimatePomodoros: 2,
      subtasks: ["第一步", "第二步"],
    };
    const task = instantiateTemplate(template, "2026-05-10T10:00:00.000Z");
    expect(task.subtasks).toHaveLength(2);
    expect(task.project).toBe("测试");
  });

  it("parses natural language quick input and filters reports", () => {
    const parsed = parseQuickInput("明天10点 写周报 #工作 @运营 2p !!", new Date("2026-05-10T08:00:00+08:00"));
    expect(parsed.title).toBe("写周报");
    expect(parsed.tags).toEqual(["工作"]);
    expect(parsed.project).toBe("运营");
    expect(parsed.priority).toBe("high");
    expect(parsed.estimatePomodoros).toBe(2);
    expect(parsed.dueAt).toBeTruthy();

    const state = createInitialState();
    const filter = { range: "30d" as const, project: "TimeManage", tag: "all", taskId: "all" };
    expect(filteredStateForReport(state, filter).tasks.every((task) => task.project === "TimeManage")).toBe(true);
    expect(reviewSummary(state, filter).rangeLabel).toBe("近 30 天");
  });
});
