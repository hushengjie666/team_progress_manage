import { describe, expect, it } from "vitest";
import { createInitialState } from "./test/fixtures";
import { createProjectInState } from "./teamProgress";
import {
  buildMyProjectTaskCards,
} from "./projectOverview";
import type { AppState } from "./types";

describe("my project task cards", () => {
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
});
