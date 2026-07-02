import { describe, expect, it } from "vitest";
import { createInitialState, todayKey } from "./seed";
import { currentMemberForState, currentTaskForFocus, deriveWorkspaceModel } from "./workbenchModel";
import type { ProjectMember, Task, WorkspaceMembership } from "./types";

const task = (id: string, status: Task["status"], sortOrder: number): Task => ({
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
  createdAt: "2026-06-30T08:00:00.000Z",
  updatedAt: "2026-06-30T08:00:00.000Z",
});

describe("workbench focus model", () => {
  it("keeps pending-review tasks visible as the current focus feedback", () => {
    const state = createInitialState();
    const pendingReviewTask = task("task_review", "pending_review", 10);
    const committedTask = task("task_committed", "committed", 20);
    const next = currentTaskForFocus(
      { ...state, tasks: [pendingReviewTask, committedTask], activeTimer: undefined },
      [pendingReviewTask, committedTask],
    );

    expect(next?.id).toBe(pendingReviewTask.id);
  });

  it("still prefers in-progress tasks over pending review feedback", () => {
    const state = createInitialState();
    const pendingReviewTask = task("task_review", "pending_review", 10);
    const inProgressTask = task("task_running", "in_progress", 20);
    const next = currentTaskForFocus(
      { ...state, tasks: [pendingReviewTask, inProgressTask], activeTimer: undefined },
      [pendingReviewTask, inProgressTask],
    );

    expect(next?.id).toBe(inProgressTask.id);
  });

  it("keeps the submitted review task pinned in the focus panel until the user switches", () => {
    const state = createInitialState();
    const pendingReviewTask = task("task_review", "pending_review", 10);
    const inProgressTask = task("task_running", "in_progress", 20);
    const next = currentTaskForFocus(
      { ...state, tasks: [pendingReviewTask, inProgressTask], activeTimer: undefined },
      [pendingReviewTask, inProgressTask],
      pendingReviewTask.id,
    );

    expect(next?.id).toBe(pendingReviewTask.id);
  });
});

describe("workbench activity pool", () => {
  it("uses the authenticated account while keeping accessible project tasks visible", () => {
    const state = createInitialState();
    const owner = state.projectMembers[0];
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const ownerTask = {
      ...task("task_owner", "committed", 10),
      primaryExecutorMemberId: owner.id,
    };
    const teammateTask = {
      ...task("task_teammate", "committed", 20),
      primaryExecutorMemberId: teammate.id,
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [ownerTask.id, teammateTask.id],
      completedPomodoros: 0,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const loggedInState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: owner.accountId!,
          workspaceId: "workspace_test",
          name: owner.name,
          email: owner.email!,
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z",
        },
      },
      projectMembers: [teammate, owner],
      tasks: [teammateTask, ownerTask],
    };
    const model = deriveWorkspaceModel(
      loggedInState,
      todayPlan,
      0,
      [teammateTask, ownerTask],
      [],
      [],
    );

    expect(currentMemberForState(loggedInState)?.id).toBe(owner.id);
    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual(["task_owner", "task_teammate"]);
  });

  it("does not fall back to another person when the authenticated account has no project member", () => {
    const state = createInitialState();
    const otherMember = {
      ...state.projectMembers[0],
      accountId: "account_other",
      email: "other@example.com",
      name: "王硕",
    };
    const otherTask = {
      ...task("task_other", "committed", 10),
      primaryExecutorMemberId: otherMember.id,
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [otherTask.id],
      completedPomodoros: 0,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const loggedInState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: "account_current",
          workspaceId: "workspace_test",
          name: "胡圣杰",
          email: "hushengjie@example.com",
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z",
        },
      },
      projectMembers: [otherMember],
      tasks: [otherTask],
    };
    const model = deriveWorkspaceModel(
      loggedInState,
      todayPlan,
      0,
      [otherTask],
      [],
      [],
    );

    expect(currentMemberForState(loggedInState)).toBeUndefined();
    expect(model.committedWorkbenchTasks).toEqual([]);
  });

  it("shows workspace-accessible projects and their active tasks even without a project member binding", () => {
    const state = createInitialState();
    const workspaceId = "workspace_disinfection";
    const unassignedTask = {
      ...task("task_disinfection_unassigned", "pool", 10),
      projectId: state.projects[0].id,
      project: "消毒中心",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
    };
    const otherAssignedTask = {
      ...task("task_disinfection_assigned_other", "pool", 20),
      projectId: state.projects[0].id,
      project: "消毒中心",
      primaryExecutorMemberId: "member_other",
    };
    const membership: WorkspaceMembership = {
      id: "membership_wangshuo_disinfection",
      workspaceId,
      accountId: "account_wangshuo",
      name: "王硕",
      email: "wangshuo@example.com",
      role: "member",
      status: "active",
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const loggedInState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: "account_wangshuo",
          workspaceId,
          name: "王硕",
          email: "wangshuo@example.com",
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z",
        },
        workspace: {
          id: workspaceId,
          name: "宁波团队出击",
          type: "shared" as const,
          ownerAccountId: "account_owner",
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z",
        },
        workspaces: [{
          id: workspaceId,
          name: "宁波团队出击",
          type: "shared" as const,
          ownerAccountId: "account_owner",
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z",
        }],
        workspaceMemberships: [membership],
      },
      projects: state.projects.map((project) => ({ ...project, name: "消毒中心", workspaceId })),
      projectMembers: [],
      tasks: [unassignedTask, otherAssignedTask],
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [],
      completedPomodoros: 0,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };

    const model = deriveWorkspaceModel(
      loggedInState,
      todayPlan,
      0,
      [],
      [unassignedTask, otherAssignedTask],
      [],
    );

    expect(currentMemberForState(loggedInState)).toBeUndefined();
    expect(model.myProjectTaskCards.map((card) => card.name)).toEqual(["消毒中心"]);
    expect(model.availableWorkbenchProjectIds).toEqual([state.projects[0].id]);
    expect(model.poolWorkbenchTasks.map((item) => item.id)).toEqual([
      "task_disinfection_unassigned",
      "task_disinfection_assigned_other",
    ]);
  });

  it("does not treat the authenticated workspace list as access without membership or project binding", () => {
    const state = createInitialState();
    const privateWorkspace = {
      id: "workspace_wangshuo_private",
      name: "王硕的私人工作区",
      type: "private" as const,
      ownerAccountId: "account_wangshuo",
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const sharedWorkspace = {
      id: "workspace_disinfection",
      name: "宁波团队出击",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const unassignedTask = {
      ...task("task_disinfection_unassigned", "pool", 10),
      projectId: state.projects[0].id,
      project: "消毒中心",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
    };
    const loggedInState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: "account_wangshuo",
          workspaceId: privateWorkspace.id,
          name: "王硕",
          email: "wangshuo@example.com",
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z",
        },
        workspace: privateWorkspace,
        workspaces: [privateWorkspace, sharedWorkspace],
        workspaceMemberships: [],
      },
      projects: state.projects.map((project) => ({ ...project, name: "消毒中心", workspaceId: sharedWorkspace.id })),
      projectMembers: [],
      tasks: [unassignedTask],
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [],
      completedPomodoros: 0,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };

    const model = deriveWorkspaceModel(
      loggedInState,
      todayPlan,
      0,
      [],
      [unassignedTask],
      [],
    );

    expect(currentMemberForState(loggedInState)).toBeUndefined();
    expect(model.myProjectTaskCards.map((card) => card.name)).toEqual([]);
    expect(model.poolWorkbenchTasks.map((item) => item.id)).toEqual([]);
  });

  it("keeps completed committed tasks visible in today's work queue", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const completedTask = {
      ...task("task_completed_today", "completed", 10),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: state.projectMembers[0].id,
    };
    const committedTask = {
      ...task("task_committed_today", "committed", 20),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: state.projectMembers[0].id,
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [completedTask.id, committedTask.id],
      completedPomodoros: 1,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const model = deriveWorkspaceModel(
      { ...state, tasks: [completedTask, committedTask] },
      todayPlan,
      0,
      [completedTask, committedTask],
      [],
      [],
    );

    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual(["task_completed_today", "task_committed_today"]);
  });

  it("keeps completed tasks visible when they are no longer in today's committed ids", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const completedTask = {
      ...task("task_completed_removed_from_plan", "completed", 10),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: state.projectMembers[0].id,
      completedAt: `${todayKey()}T09:30:00.000Z`,
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [],
      completedPomodoros: 1,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const model = deriveWorkspaceModel(
      { ...state, tasks: [completedTask] },
      todayPlan,
      0,
      [],
      [],
      [],
    );

    expect(model.availableWorkbenchProjectIds).toEqual([projectId]);
    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual(["task_completed_removed_from_plan"]);
  });

  it("does not show completed tasks from earlier days in today's work queue", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const completedTask = {
      ...task("task_completed_yesterday", "completed", 10),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: state.projectMembers[0].id,
      completedAt: "2026-06-29T09:30:00.000Z",
    };
    const todayPlan = {
      id: "plan_test_today",
      date: "2026-06-30",
      capacityPomodoros: 4,
      committedTaskIds: [],
      completedPomodoros: 1,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const model = deriveWorkspaceModel(
      { ...state, tasks: [completedTask] },
      todayPlan,
      0,
      [],
      [],
      [],
    );

    expect(model.committedWorkbenchTasks).toEqual([]);
  });

  it("keeps completed tasks visible when the member worked on them without direct assignment", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const completedTask = {
      ...task("task_completed_by_work_session", "completed", 10),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: undefined,
      completedAt: `${todayKey()}T09:30:00.000Z`,
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [],
      completedPomodoros: 1,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const model = deriveWorkspaceModel(
      {
        ...state,
        tasks: [completedTask],
        workSessions: [
          {
            id: "work_session_test",
            taskId: completedTask.id,
            executorMemberId: state.projectMembers[0].id,
            focusSessionId: "session_test",
            status: "ended",
            startedAt: `${todayKey()}T09:00:00.000Z`,
            endedAt: `${todayKey()}T09:30:00.000Z`,
            totalPausedSeconds: 0,
            createdAt: `${todayKey()}T09:00:00.000Z`,
            updatedAt: `${todayKey()}T09:30:00.000Z`,
          },
        ],
      },
      todayPlan,
      0,
      [],
      [],
      [],
    );

    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual(["task_completed_by_work_session"]);
  });

  it("keeps unassigned today tasks visible for the project owner like member status does", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const unassignedCompletedTask = {
      ...task("task_owner_unassigned_completed", "completed", 10),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      completedAt: `${todayKey()}T09:30:00.000Z`,
    };
    const unassignedCommittedTask = {
      ...task("task_owner_unassigned_committed", "committed", 20),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [unassignedCompletedTask.id, unassignedCommittedTask.id],
      completedPomodoros: 1,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const model = deriveWorkspaceModel(
      { ...state, tasks: [unassignedCompletedTask, unassignedCommittedTask] },
      todayPlan,
      0,
      [unassignedCompletedTask, unassignedCommittedTask],
      [],
      [],
    );

    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual([
      "task_owner_unassigned_completed",
      "task_owner_unassigned_committed",
    ]);
  });

  it("keeps unassigned pool tasks available for the unassigned visibility toggle", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const unassignedTask = {
      ...task("task_unassigned", "pool", 10),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
    };
    const assignedTask = {
      ...task("task_assigned", "pool", 20),
      projectId,
      project: state.projects[0].name,
      primaryExecutorMemberId: state.projectMembers[0].id,
    };
    const todayPlan = {
      id: "plan_test_today",
      date: todayKey(),
      capacityPomodoros: 4,
      committedTaskIds: [],
      completedPomodoros: 0,
      suggestedTaskIds: [],
      reflection: "",
      review: { mood: "normal" as const, wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z",
    };
    const model = deriveWorkspaceModel(
      { ...state, tasks: [unassignedTask, assignedTask] },
      todayPlan,
      0,
      [],
      [unassignedTask, assignedTask],
      [],
    );

    expect(model.poolWorkbenchTasks.map((item) => item.id)).toEqual(["task_unassigned", "task_assigned"]);
  });
});
