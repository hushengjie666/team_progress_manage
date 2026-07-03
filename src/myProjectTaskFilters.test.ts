import { describe, expect, it } from "vitest";
import { filterProjectTasks } from "./projectDetail";
import {
  buildProjectOverviewCards,
  filterMyTasksByProjectSelection,
  quickAddProjectIdForSelection,
} from "./projectOverview";
import { createInitialState } from "./test/fixtures";
import { createProjectInState } from "./teamProgress";
import type { AppState } from "./types";

describe("my project task filters", () => {
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
