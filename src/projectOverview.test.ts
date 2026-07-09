import { describe, expect, it } from "vitest";
import { createInitialState, iso } from "./test/fixtures";
import {
  createProjectInState,
  reorderProjectsInState,
} from "./teamProgress";
import {
  buildProjectOverviewCards,
} from "./projectOverview";
import type { Account, AppState, Workspace } from "./types";

const timestamp = "2026-05-10T09:00:00.000Z";

const account: Account = {
  id: "account_owner",
  workspaceId: "workspace_private_owner",
  name: "负责人",
  email: "owner@example.com",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const privateWorkspace: Workspace = {
  id: "workspace_private_owner",
  name: "个人工作区",
  type: "private",
  ownerAccountId: account.id,
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe("project overview cards", () => {
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

  it("does not treat projects with unknown workspace ids as the current workspace", () => {
    const state = createInitialState();
    const projectTemplate = state.projects[0];
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated",
        account,
        workspace: privateWorkspace,
        workspaces: [privateWorkspace],
        message: "已登录",
      },
      projects: [
        {
          ...projectTemplate,
          id: "project_unknown_workspace",
          name: "未知工作区项目",
          workspaceId: "workspace_missing",
        },
      ],
      projectMembers: [],
      tasks: [],
    };

    expect(buildProjectOverviewCards(next)).toEqual([]);
  });
});
