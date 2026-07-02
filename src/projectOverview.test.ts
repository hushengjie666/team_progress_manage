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
  reorderProjectsInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
  updateProjectMemberInState,
  updateTaskProgressInState,
} from "./teamProgress";
import { buildProjectOverviewTaskBoard, createProjectTaskInState, deriveProjectDetailModel, filterProjectTasks, projectAccessForCurrentMember, projectTasksForProject } from "./projectDetail";
import { resolveMemberIdForProject } from "./memberIdentity";
import {
  buildMyProjectTaskCards,
  buildProjectOverviewCards,
  accessibleProjectIdsForCurrentUser,
  filterTodayCommittedTasksForMember,
  filterMyTasksByProjectSelection,
  quickAddProjectIdForSelection,
} from "./projectOverview";
import { bindAccountToMembers } from "./authModel";
import type { ActiveTimer, AppState, FocusSession, ProjectMember, Task, TaskTemplate, WorkspaceMembership } from "./types";

describe("project overview", () => {
  it("builds project overview cards with project-scoped counts and archived tasks", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "用于验证卡片隔离",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_second_card`,
    );
    const next: AppState = {
      ...withSecondProject,
      tasks: [
        { ...state.tasks[0], id: "card_first_archived", projectId: firstProjectId, status: "archived" },
        { ...state.tasks[1], id: "card_first_review", projectId: firstProjectId, status: "pending_review", progressPercent: 100 },
        { ...state.tasks[2], id: "card_second_progress", projectId: "project_second_card", status: "in_progress", progressPercent: 40 },
      ],
      projectMembers: [
        ...withSecondProject.projectMembers,
        {
          id: "member_disabled_card",
          projectId: firstProjectId,
          name: "停用成员",
          roles: ["executor"],
          status: "disabled",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      ],
    };

    const cards = buildProjectOverviewCards(next);
    const first = cards.find((card) => card.projectId === firstProjectId);
    const second = cards.find((card) => card.projectId === "project_second_card");

    expect(first).toMatchObject({
      taskCount: 2,
      memberCount: 1,
      pendingReviewCount: 1,
      statusCounts: expect.objectContaining({ archived: 1, pending_review: 1 }),
    });
    expect(second).toMatchObject({
      taskCount: 1,
      inProgressCount: 1,
      statusCounts: expect.objectContaining({ in_progress: 1, archived: 0 }),
    });
  });

  it("counts everyone with project access in project overview cards", () => {
    const state = createInitialState();
    const workspaceId = "workspace_shared_access_count";
    const workspaceMemberships: WorkspaceMembership[] = [
      {
        id: "membership_owner_access_count",
        workspaceId,
        accountId: "account_owner",
        name: "项目负责人",
        email: "owner@example.com",
        role: "owner",
        status: "active",
        createdAt: iso("2026-05-10T08:00:00Z"),
        updatedAt: iso("2026-05-10T08:00:00Z"),
      },
      {
        id: "membership_teammate_access_count",
        workspaceId,
        accountId: "account_teammate",
        name: "协作成员",
        email: "teammate@example.com",
        role: "member",
        status: "active",
        createdAt: iso("2026-05-10T08:00:00Z"),
        updatedAt: iso("2026-05-10T08:00:00Z"),
      },
      {
        id: "membership_disabled_access_count",
        workspaceId,
        accountId: "account_disabled",
        name: "停用成员",
        email: "disabled@example.com",
        role: "member",
        status: "disabled",
        createdAt: iso("2026-05-10T08:00:00Z"),
        updatedAt: iso("2026-05-10T08:00:00Z"),
      },
    ];
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        workspace: {
          id: workspaceId,
          name: "协作区",
          type: "shared",
          ownerAccountId: "account_owner",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
        workspaces: [{
          id: workspaceId,
          name: "协作区",
          type: "shared",
          ownerAccountId: "account_owner",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        }],
        workspaceMemberships,
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: [
        ...state.projectMembers,
        {
          id: "member_project_only_access_count",
          workspaceId,
          projectId: state.projects[0].id,
          name: "项目单独成员",
          email: "contractor@example.com",
          roles: ["executor"],
          status: "active",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
        {
          id: "member_duplicate_workspace_access_count",
          workspaceId,
          projectId: state.projects[0].id,
          accountId: "account_teammate",
          name: "协作成员",
          email: "teammate@example.com",
          roles: ["executor"],
          status: "active",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
        {
          id: "member_disabled_project_access_count",
          workspaceId,
          projectId: state.projects[0].id,
          name: "停用项目成员",
          email: "project-disabled@example.com",
          roles: ["executor"],
          status: "disabled",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
      ],
    };

    expect(buildProjectOverviewCards(next)[0]).toMatchObject({
      memberCount: 3,
      workspaceName: "协作区",
    });
  });

  it("does not treat workspace summaries as workspace-level access for project invitees", () => {
    const state = createInitialState();
    const now = iso("2026-05-10T08:00:00Z");
    const sharedWorkspace = {
      id: "workspace_summary_only",
      name: "摘要协作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: now,
      updatedAt: now,
    };
    const privateWorkspace = {
      id: "workspace_private_invitee",
      name: "受邀者私人区",
      type: "private" as const,
      ownerAccountId: "account_invitee",
      createdAt: now,
      updatedAt: now,
    };
    const invitedProject = { ...state.projects[0], id: "project_invited_only", name: "受邀项目", workspaceId: sharedWorkspace.id };
    const hiddenProject = { ...state.projects[0], id: "project_workspace_hidden", name: "工作区隐藏项目", workspaceId: sharedWorkspace.id };
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated",
        account: {
          id: "account_invitee",
          workspaceId: privateWorkspace.id,
          name: "受邀者",
          email: "invitee@example.com",
          createdAt: now,
          updatedAt: now,
        },
        workspace: privateWorkspace,
        workspaces: [privateWorkspace, sharedWorkspace],
        membership: {
          id: "membership_private_invitee",
          workspaceId: privateWorkspace.id,
          accountId: "account_invitee",
          name: "受邀者",
          email: "invitee@example.com",
          role: "owner",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        workspaceMemberships: [
          {
            id: "membership_private_invitee",
            workspaceId: privateWorkspace.id,
            accountId: "account_invitee",
            name: "受邀者",
            email: "invitee@example.com",
            role: "owner",
            status: "active",
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      projects: [invitedProject, hiddenProject],
      projectMembers: [
        {
          id: "member_invited_only",
          workspaceId: sharedWorkspace.id,
          projectId: invitedProject.id,
          accountId: "account_invitee",
          name: "受邀者",
          email: "invitee@example.com",
          roles: ["executor"],
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
      tasks: [],
    };

    expect([...accessibleProjectIdsForCurrentUser(next)].sort()).toEqual([invitedProject.id]);
    expect(buildProjectOverviewCards(next).map((card) => card.projectId)).toEqual([invitedProject.id]);
    expect(buildProjectOverviewCards(next)[0]).toMatchObject({
      memberCount: 2,
      workspaceName: "摘要协作区",
    });
  });

  it("uses workspace memberships for project access counts", () => {
    const state = createInitialState();
    const workspaceId = "workspace_shared_team_member_count";
    const workspace = {
      id: workspaceId,
      name: "协作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: iso("2026-05-10T08:00:00Z"),
      updatedAt: iso("2026-05-10T08:00:00Z"),
    };
    const workspaceMemberships: WorkspaceMembership[] = [
      {
        id: "membership_owner_count",
        workspaceId,
        accountId: "account_owner",
        name: "负责人",
        email: "owner@example.com",
        role: "owner",
        status: "active",
        createdAt: iso("2026-05-10T08:00:00Z"),
        updatedAt: iso("2026-05-10T08:00:00Z"),
      },
      {
        id: "membership_teammate_count",
        workspaceId,
        accountId: "account_teammate",
        name: "协作成员",
        email: "teammate@example.com",
        role: "member",
        status: "active",
        createdAt: iso("2026-05-10T08:00:00Z"),
        updatedAt: iso("2026-05-10T08:00:00Z"),
      },
      {
        id: "membership_disabled_count",
        workspaceId,
        accountId: "account_disabled",
        name: "停用成员",
        email: "disabled@example.com",
        role: "member",
        status: "disabled",
        createdAt: iso("2026-05-10T08:00:00Z"),
        updatedAt: iso("2026-05-10T08:00:00Z"),
      },
    ];
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        workspace,
        workspaces: [workspace],
        workspaceMemberships,
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: state.projectMembers.map((member) => ({
        ...member,
        workspaceId,
        accountId: "account_owner",
        email: "owner@example.com",
      })),
    };

    expect(buildProjectOverviewCards(next)[0]).toMatchObject({
      memberCount: 2,
      workspaceName: "协作区",
    });
  });

  it("counts the workspace owner and active workspace members on project cards", () => {
    const state = createInitialState();
    const workspaceId = "workspace_owner_fallback";
    const workspace = {
      id: workspaceId,
      name: "旧数据协作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: iso("2026-05-10T08:00:00Z"),
      updatedAt: iso("2026-05-10T08:00:00Z"),
    };
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        account: {
          id: "account_wangshuo",
          workspaceId,
          name: "王硕",
          email: "wangshuo",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
        workspace,
        workspaces: [workspace],
        membership: {
          id: "membership_wangshuo_owner_fallback",
          workspaceId,
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          role: "member",
          status: "active",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
        workspaceMemberships: [
          {
            id: "membership_wangshuo_owner_fallback",
            workspaceId,
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo",
            role: "member",
            status: "active",
            createdAt: iso("2026-05-10T08:00:00Z"),
            updatedAt: iso("2026-05-10T08:00:00Z"),
          },
        ],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: [],
    };

    expect(buildProjectOverviewCards(next)[0]).toMatchObject({
      memberCount: 2,
      workspaceName: "旧数据协作区",
    });
  });

  it("uses inherited workspace access for project detail member totals", () => {
    const state = createInitialState();
    const workspaceId = "workspace_project_detail_members";
    const workspace = {
      id: workspaceId,
      name: "详情协作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: iso("2026-05-10T08:00:00Z"),
      updatedAt: iso("2026-05-10T08:00:00Z"),
    };
    const projectId = state.projects[0].id;
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        account: {
          id: "account_wangshuo",
          workspaceId,
          name: "王硕",
          email: "wangshuo",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
        workspace,
        workspaces: [workspace],
        membership: {
          id: "membership_wangshuo_detail",
          workspaceId,
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          role: "member",
          status: "active",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
        workspaceMemberships: [
          {
            id: "membership_owner_detail",
            workspaceId,
            accountId: "account_owner",
            name: "负责人",
            email: "owner@example.com",
            role: "owner",
            status: "active",
            createdAt: iso("2026-05-10T08:00:00Z"),
            updatedAt: iso("2026-05-10T08:00:00Z"),
          },
          {
            id: "membership_wangshuo_detail",
            workspaceId,
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo",
            role: "member",
            status: "active",
            createdAt: iso("2026-05-10T08:00:00Z"),
            updatedAt: iso("2026-05-10T08:00:00Z"),
          },
        ],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: state.projectMembers.map((member) => ({
        ...member,
        workspaceId,
        projectId,
        accountId: "account_owner",
        email: "owner@example.com",
      })),
    };

    const model = deriveProjectDetailModel(next, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(model?.accessibleMemberCount).toBe(2);
    expect(model?.memberOverviewStats.find((item) => item.label === "项目成员")?.value).toBe(2);
    expect(model?.memberOverviewStats.find((item) => item.label === "执行者")?.value).toBe(2);
    expect(model?.accessibleProjectMembers.map((member) => ({ name: member.name, source: member.source }))).toEqual([
      { name: "项目负责人", source: "project" },
      { name: "王硕", source: "workspace" },
    ]);
  });

  it("shows inherited workspace memberships in project detail when team member rows are unavailable", () => {
    const state = createInitialState();
    const workspaceId = "workspace_detail_membership_only";
    const projectId = state.projects[0].id;
    const workspace = {
      id: workspaceId,
      name: "后端成员协作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: iso("2026-05-10T08:00:00Z"),
      updatedAt: iso("2026-05-10T08:00:00Z"),
    };
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        account: {
          id: "account_owner",
          workspaceId,
          name: "负责人",
          email: "owner@example.com",
          createdAt: iso("2026-05-10T08:00:00Z"),
          updatedAt: iso("2026-05-10T08:00:00Z"),
        },
        workspace,
        workspaces: [workspace],
        membership: undefined,
        workspaceMemberships: [
          {
            id: "membership_owner_detail_only",
            workspaceId,
            accountId: "account_owner",
            name: "负责人",
            email: "owner@example.com",
            role: "owner",
            status: "active",
            createdAt: iso("2026-05-10T08:00:00Z"),
            updatedAt: iso("2026-05-10T08:00:00Z"),
          },
          {
            id: "membership_wangshuo_detail_only",
            workspaceId,
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo",
            role: "member",
            status: "active",
            createdAt: iso("2026-05-10T08:00:00Z"),
            updatedAt: iso("2026-05-10T08:00:00Z"),
          },
        ],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: state.projectMembers.map((member) => ({
        ...member,
        workspaceId,
        projectId,
        accountId: "account_owner",
        name: "负责人",
        email: "owner@example.com",
      })),
    };

    const model = deriveProjectDetailModel(next, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(model?.accessibleMemberCount).toBe(2);
    expect(model?.memberOverviewStats.find((item) => item.label === "项目成员")?.value).toBe(2);
    expect(model?.memberOverviewStats.find((item) => item.label === "执行者")?.value).toBe(2);
    expect(model?.accessibleProjectMembers.map((member) => ({ name: member.name, source: member.source, label: member.sourceLabel }))).toEqual([
      { name: "负责人", source: "project", label: "项目成员" },
      { name: "王硕", source: "workspace", label: "工作区成员" },
    ]);
  });

  it("deduplicates project and workspace member identities across account and email fields", () => {
    const state = createInitialState();
    const workspaceId = "workspace_detail_member_identity";
    const projectId = state.projects[0].id;
    const workspace = {
      id: workspaceId,
      name: "身份去重协作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: iso("2026-05-10T08:00:00Z"),
      updatedAt: iso("2026-05-10T08:00:00Z"),
    };
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        workspace,
        workspaces: [workspace],
        membership: undefined,
        workspaceMemberships: [
          {
            id: "membership_owner_identity",
            workspaceId,
            accountId: "account_owner",
            name: "负责人",
            email: "owner@example.com",
            role: "owner",
            status: "active",
            createdAt: iso("2026-05-10T08:00:00Z"),
            updatedAt: iso("2026-05-10T08:00:00Z"),
          },
          {
            id: "membership_wangshuo_identity",
            workspaceId,
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo",
            role: "member",
            status: "active",
            createdAt: iso("2026-05-10T08:00:00Z"),
            updatedAt: iso("2026-05-10T08:00:00Z"),
          },
        ],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: state.projectMembers.map((member) => ({
        ...member,
        workspaceId,
        projectId,
        accountId: undefined,
        name: "负责人",
        email: "owner@example.com",
      })),
    };

    const model = deriveProjectDetailModel(next, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(buildProjectOverviewCards(next)[0]).toMatchObject({ memberCount: 2 });
    expect(model?.accessibleMemberCount).toBe(2);
    expect(model?.accessibleProjectMembers.map((member) => member.name)).toEqual(["负责人", "王硕"]);
  });

  it("keeps project overview cards in persisted sort order", () => {
    const state = createInitialState();
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "yolo识别",
      iso("2026-05-11T08:00:00Z"),
      (prefix) => `${prefix}_overview_order`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const reordered: AppState = {
      ...withSecondProject,
      projects: withSecondProject.projects.map((project) =>
        project.id === "project_overview_order"
          ? { ...project, sortOrder: 0, updatedAt: iso("2026-05-11T08:00:00Z") }
          : { ...project, sortOrder: 1000, updatedAt: iso("2026-05-12T08:00:00Z") },
      ),
    };

    expect(buildProjectOverviewCards(reordered).map((card) => card.projectId)).toEqual([
      "project_overview_order",
      state.projects[0].id,
    ]);
  });

  it("stores dragged project overview order on projects", () => {
    const state = createInitialState();
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "yolo识别",
      iso("2026-05-11T08:00:00Z"),
      (prefix) => `${prefix}_drag_order`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const reordered = reorderProjectsInState(
      withSecondProject,
      ["project_drag_order", state.projects[0].id],
      iso("2026-05-12T08:00:00Z"),
    );

    expect(reordered.projects.find((project) => project.id === "project_drag_order")?.sortOrder).toBe(0);
    expect(reordered.projects.find((project) => project.id === state.projects[0].id)?.sortOrder).toBe(1000);
    expect(buildProjectOverviewCards(reordered).map((card) => card.projectId)).toEqual([
      "project_drag_order",
      state.projects[0].id,
    ]);
  });

  it("builds the project detail overview board from pooled work and member today work groups", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const owner = state.projectMembers.find((member) => member.id === "member_owner");
    const reviewer = {
      ...owner!,
      id: "member_reviewer_overview",
      name: "协作者",
      roles: owner!.roles,
    };
    const baseTask = state.tasks[0];
    const tasks = [
      { ...baseTask, id: "overview_pool", projectId, status: "pool" as const, sortOrder: 1 },
      { ...baseTask, id: "overview_committed", projectId, status: "committed" as const, sortOrder: 2 },
      { ...baseTask, id: "overview_active", projectId, status: "in_progress" as const, primaryExecutorMemberId: owner?.id, sortOrder: 3 },
      { ...baseTask, id: "overview_other_running", projectId, status: "in_progress" as const, primaryExecutorMemberId: reviewer.id, sortOrder: 4 },
      { ...baseTask, id: "overview_unassigned", projectId, status: "in_progress" as const, primaryExecutorMemberId: undefined, sortOrder: 5 },
      { ...baseTask, id: "overview_review", projectId, status: "pending_review" as const, sortOrder: 6 },
      { ...baseTask, id: "overview_split", projectId, status: "split" as const, sortOrder: 7 },
      { ...baseTask, id: "overview_archived", projectId, status: "archived" as const, sortOrder: 8 },
    ];

    const idleMember: ProjectMember = {
      ...reviewer,
      id: "member_idle",
      name: "空闲成员",
      roles: ["executor"],
    };
    const board = buildProjectOverviewTaskBoard(
      tasks,
      [owner!, reviewer, idleMember],
      "overview_active",
      ["overview_active", "overview_committed", "overview_other_running", "overview_unassigned"],
    );

    expect(board.poolTasks.map((task) => task.id)).toEqual(["overview_pool", "overview_committed"]);
    expect(board.pendingReviewTasks.map((task) => task.id)).toEqual(["overview_review"]);
    expect(board.inProgressTasks.map((task) => task.id)).toEqual(["overview_active", "overview_other_running", "overview_unassigned"]);
    expect(board.todayWorkGroups.map((group) => ({
      memberName: group.memberName,
      taskIds: group.tasks.map((task) => task.id),
      hasActiveTask: group.hasActiveTask,
    }))).toEqual([
      { memberName: "项目负责人", taskIds: ["overview_active", "overview_committed"], hasActiveTask: true },
      { memberName: "协作者", taskIds: ["overview_other_running"], hasActiveTask: false },
      { memberName: "未分配", taskIds: ["overview_unassigned"], hasActiveTask: false },
      { memberName: "空闲成员", taskIds: [], hasActiveTask: false },
    ]);
  });

  it("shows active project work even when it is missing from the current user's daily plan", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const baseTask = state.tasks[0];
    const tasks = [
      { ...baseTask, id: "not_today_committed", projectId, status: "committed" as const, primaryExecutorMemberId: owner.id, sortOrder: 1 },
      { ...baseTask, id: "not_today_running", projectId, status: "in_progress" as const, primaryExecutorMemberId: owner.id, sortOrder: 2 },
    ];

    const board = buildProjectOverviewTaskBoard(tasks, [owner], "not_today_running", []);

    expect(board.poolTasks.map((task) => task.id)).toEqual(["not_today_committed"]);
    expect(board.inProgressTasks.map((task) => task.id)).toEqual(["not_today_running"]);
    expect(board.todayWorkGroups).toEqual([
      {
        memberId: owner.id,
        memberName: owner.name,
        tasks: [tasks[1]],
        hasActiveTask: true,
      },
    ]);
  });

  it("sorts accepted project detail tasks by newest review acceptance", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const baseTask = state.tasks[0];
    const acceptedOld = {
      ...baseTask,
      id: "accepted_old",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: "2026-05-10T09:00:00.000Z",
      completedAt: "2026-05-10T09:00:00.000Z",
    };
    const acceptedNew = {
      ...baseTask,
      id: "accepted_new",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: "2026-05-10T11:00:00.000Z",
      completedAt: "2026-05-10T11:00:00.000Z",
    };
    const manuallyCompleted = {
      ...baseTask,
      id: "manual_done",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: undefined,
      completedAt: "2026-05-10T12:00:00.000Z",
    };
    const model = deriveProjectDetailModel(
      { ...state, tasks: [manuallyCompleted, acceptedOld, acceptedNew, ...state.tasks] },
      projectId,
      { query: "", status: "all", executor: "all", priority: "all", sort: "status" },
      todayKey(),
    );

    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("accepted_new");
    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("accepted_old");
    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("manual_done");
    expect(model?.acceptedTasks.map((task) => task.id)).toEqual(["accepted_new", "accepted_old"]);
  });

  it("builds my project task cards from accessible project tasks", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "同一账号参与的另一个项目",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_my_card`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_my_card");
    const currentMember = withSecondProject.projectMembers.find((member) => member.id === "member_owner");
    const next: AppState = {
      ...withSecondProject,
      tasks: [
        { ...state.tasks[0], id: "my_first_committed", projectId: firstProjectId, status: "committed", primaryExecutorMemberId: "member_owner" },
        { ...state.tasks[1], id: "my_first_done", projectId: firstProjectId, status: "completed", primaryExecutorMemberId: "member_owner" },
        { ...state.tasks[2], id: "my_second_progress", projectId: "project_my_card", project: "第二项目", status: "in_progress", primaryExecutorMemberId: secondMember?.id },
        { ...state.tasks[3], id: "other_second_pool", projectId: "project_my_card", project: "第二项目", status: "pool", primaryExecutorMemberId: "member_other" },
      ],
      projectMembers: [
        ...withSecondProject.projectMembers,
        {
          id: "member_disabled_participation",
          projectId: "project_disabled",
          accountId: "account_owner",
          name: "停用成员",
          roles: ["executor"],
          status: "disabled",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      ],
    };

    const cards = buildMyProjectTaskCards(next, currentMember);

    expect(cards.map((card) => card.projectId).sort()).toEqual([firstProjectId, "project_my_card"].sort());
    expect(cards.find((card) => card.projectId === firstProjectId)).toMatchObject({
      myTaskCount: 1,
      committedCount: 1,
    });
    expect(cards.find((card) => card.projectId === "project_my_card")).toMatchObject({
      myTaskCount: 2,
      inProgressCount: 1,
      poolCount: 1,
    });
    expect(cards.some((card) => card.projectId === "project_disabled")).toBe(false);
  });

  it("filters today committed tasks to the current member for the focus todo list", () => {
    const state = createInitialState();
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      accountId: "account_teammate",
      name: "胡圣杰",
      email: "husj",
      roles: ["executor"],
    };
    const ownerTask = {
      ...state.tasks[0],
      id: "today_owner_task",
      primaryExecutorMemberId: owner.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const teammateTask = {
      ...state.tasks[1],
      id: "today_teammate_task",
      primaryExecutorMemberId: teammate.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const unassignedTask = {
      ...state.tasks[2],
      id: "today_unassigned_task",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const next: AppState = {
      ...state,
      projectMembers: [...state.projectMembers, teammate],
      tasks: [ownerTask, teammateTask, unassignedTask],
      dailyPlans: [
        {
          ...getTodayPlan(state),
          committedTaskIds: [ownerTask.id, teammateTask.id, unassignedTask.id],
        },
      ],
    };

    const committedTasks = next.dailyPlans[0].committedTaskIds
      .map((id) => next.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(filterTodayCommittedTasksForMember(next, committedTasks, owner).map((task) => task.id)).toEqual([ownerTask.id]);
  });

  it("keeps old unassigned committed tasks visible only for the member who has worked on them", () => {
    const state = createInitialState();
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const unassignedTask = {
      ...state.tasks[0],
      id: "today_worked_unassigned_task",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "in_progress" as const,
    };
    const next: AppState = {
      ...state,
      projectMembers: [...state.projectMembers, teammate],
      tasks: [unassignedTask],
      workSessions: [
        {
          id: "work_session_owner_unassigned",
          taskId: unassignedTask.id,
          executorMemberId: owner.id,
          focusSessionId: "focus_owner_unassigned",
          status: "ended",
          startedAt: "2026-05-10T09:00:00.000Z",
          endedAt: "2026-05-10T09:25:00.000Z",
          totalPausedSeconds: 0,
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:25:00.000Z",
        },
      ],
      dailyPlans: [
        {
          ...getTodayPlan(state),
          committedTaskIds: [unassignedTask.id],
        },
      ],
    };
    const committedTasks = next.dailyPlans[0].committedTaskIds
      .map((id) => next.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(filterTodayCommittedTasksForMember(next, committedTasks, owner).map((task) => task.id)).toEqual([unassignedTask.id]);
    expect(filterTodayCommittedTasksForMember(next, committedTasks, teammate).map((task) => task.id)).toEqual([]);
  });

  it("keeps focus tasks visible after login binds same-email executor memberships", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "第二项目",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_login_bind`,
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_login_bind")!;
    const todayPlan = getTodayPlan(withSecondProject);
    const firstTask = {
      ...state.tasks[0],
      id: "login_bind_first",
      projectId: firstProjectId,
      project: "TimeManage",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const secondTask = {
      ...state.tasks[1],
      id: "login_bind_second",
      projectId: "project_login_bind",
      project: "图像识别",
      primaryExecutorMemberId: secondMember.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const loggedIn = bindAccountToMembers(
      {
        ...withSecondProject,
        projectMembers: withSecondProject.projectMembers.map((member) =>
          member.projectId === "project_login_bind"
            ? {
                ...member,
                accountId: undefined,
                email: "owner@example.com",
                roles: ["executor"],
              }
            : member,
        ),
        tasks: [firstTask, secondTask],
        dailyPlans: [{ ...todayPlan, committedTaskIds: [firstTask.id, secondTask.id] }],
      },
      {
        status: "authenticated",
        token: "login_bind_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "项目负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );
    const currentMember = loggedIn.projectMembers.find(
      (member) => member.projectId === "project_login_bind" && member.accountId === "account_owner",
    );
    const committedTasks = loggedIn.dailyPlans[0].committedTaskIds
      .map((id) => loggedIn.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(loggedIn.projectMembers.find((member) => member.id === secondMember.id)).toMatchObject({
      accountId: "account_owner",
    });
    expect(filterTodayCommittedTasksForMember(loggedIn, committedTasks, currentMember).map((task) => task.id)).toEqual([secondTask.id]);
  });

  it("does not bind a stale selected project member to a different authenticated account", () => {
    const state = createInitialState();
    const staleMember: ProjectMember = {
      ...state.projectMembers[0],
      id: "member_stale_selected",
      accountId: undefined,
      name: "王硕",
      email: undefined,
      roles: ["project_owner", "executor"],
    };
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        projectMembers: [staleMember, ...state.projectMembers],
      },
      {
        status: "authenticated",
        token: "stale_bind_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_hushengjie",
          workspaceId: "workspace_test",
          name: "胡圣杰",
          email: "hushengjie@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.projectMembers.find((member) => member.id === staleMember.id)?.accountId).toBeUndefined();
    expect(loggedIn.projectMembers.some((member) => member.accountId === "account_hushengjie")).toBe(false);
  });

  it("does not create a project member just because an account logged in", () => {
    const state = createInitialState();
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        projectMembers: [],
      },
      {
        status: "authenticated",
        token: "no_member_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_no_member",
          workspaceId: "workspace_test",
          name: "仅登录账号",
          email: "account-only@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.projectMembers).toEqual([]);
  });

  it("clears sync retry backoff when binding an authenticated account", () => {
    const state = createInitialState();
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        sync: {
          ...state.sync,
          enabled: true,
          autoSync: false,
          status: "error",
          retryCount: 3,
          nextRetryAt: "2026-05-10T10:00:00.000Z",
        },
      },
      {
        status: "authenticated",
        token: "retry_clear_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "项目负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.sync).toMatchObject({
      enabled: true,
      autoSync: true,
      status: "idle",
      retryCount: 0,
      nextRetryAt: undefined,
    });
  });

  it("filters my tasks by selected projects and derives single quick-add project", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "用于验证项目多选过滤",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_filter_card`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_filter_card");
    const currentMember = withSecondProject.projectMembers.find((member) => member.id === "member_owner");
    const next: AppState = {
      ...withSecondProject,
      tasks: [
        { ...state.tasks[0], id: "selected_first", projectId: firstProjectId, status: "committed", primaryExecutorMemberId: "member_owner" },
        { ...state.tasks[1], id: "selected_second", projectId: "project_filter_card", project: "第二项目", status: "pool", primaryExecutorMemberId: secondMember?.id },
        { ...state.tasks[2], id: "selected_unassigned", projectId: "project_filter_card", project: "第二项目", status: "pool", primaryExecutorMemberId: undefined, collaboratorMemberIds: [] },
        { ...state.tasks[1], id: "selected_split_parent", projectId: "project_filter_card", project: "第二项目", status: "split", primaryExecutorMemberId: secondMember?.id },
        { ...state.tasks[2], id: "selected_archived", projectId: "project_filter_card", project: "第二项目", status: "archived", primaryExecutorMemberId: secondMember?.id },
        { ...state.tasks[3], id: "selected_other_member", projectId: "project_filter_card", project: "第二项目", status: "pool", primaryExecutorMemberId: "member_other" },
      ],
    };

    expect(filterMyTasksByProjectSelection(next, currentMember, [firstProjectId]).map((task) => task.id)).toEqual(["selected_first"]);
    expect(filterMyTasksByProjectSelection(next, currentMember, ["project_filter_card"]).map((task) => task.id)).toEqual([
      "selected_second",
      "selected_unassigned",
      "selected_other_member",
    ]);
    expect(filterMyTasksByProjectSelection(next, currentMember, []).map((task) => task.id)).toEqual([
      "selected_first",
      "selected_second",
      "selected_unassigned",
      "selected_other_member",
    ]);
    expect(quickAddProjectIdForSelection([firstProjectId])).toBe(firstProjectId);
    expect(quickAddProjectIdForSelection([firstProjectId, "project_filter_card"])).toBeUndefined();
  });

  it("keeps split parent tasks out of execution lists while preserving project traceability", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const currentMember = state.projectMembers[0];
    const next: AppState = {
      ...state,
      tasks: [
        { ...state.tasks[0], id: "split_parent", projectId, status: "split", primaryExecutorMemberId: currentMember?.id },
        { ...state.tasks[1], id: "split_child", projectId, status: "pool", primaryExecutorMemberId: currentMember?.id },
      ],
    };

    expect(filterMyTasksByProjectSelection(next, currentMember, []).map((task) => task.id)).toEqual(["split_child"]);
    expect(buildProjectOverviewCards(next)[0].statusCounts.split).toBe(1);
    expect(filterProjectTasks(next.tasks, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    }).map((task) => task.id)).toEqual(["split_child"]);
    expect(filterProjectTasks(next.tasks, {
      query: "",
      status: "split",
      executor: "all",
      priority: "all",
      sort: "status",
    }).map((task) => task.id)).toEqual(["split_parent"]);
  });
});
