import { describe, expect, it } from "vitest";
import {
  canShowProjectMemberManagementFor,
  createEmptyProjectTaskDraft,
  editableProjectSettingsFor,
  projectDetailActiveTabFor,
  projectTaskStatusPatch,
  projectWorkspaceOptions,
  projectWorkspaceTagLabel,
} from "./projectDetailControllerModel";
import type { Project, Task, Workspace } from "../../types";

const now = "2026-07-01T08:00:00.000Z";

const project = (overrides: Partial<Project> = {}): Project => ({
  id: "project_a",
  name: "项目 A",
  description: "说明",
  defaultExpectedStartHours: 24,
  taskStageMode: "software",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const workspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: "workspace_a",
  name: "工作区 A",
  type: "shared",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task_a",
  title: "任务 A",
  notes: "",
  tags: [],
  projectId: "project_a",
  project: "项目 A",
  collaboratorMemberIds: [],
  priority: "medium",
  severity: "medium",
  stage: "development",
  estimatePomodoros: 1,
  status: "committed",
  subtasks: [],
  sortOrder: 0,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("project detail controller model", () => {
  it("creates task drafts with the stage matching the project mode", () => {
    expect(createEmptyProjectTaskDraft("regular").stage).toBe("planning");
    expect(createEmptyProjectTaskDraft("software").stage).toBe("requirements");
  });

  it("builds editable settings from draft or project fallback", () => {
    const sourceProject = project({ workspaceId: "workspace_a" });
    const sourceWorkspace = workspace();

    expect(editableProjectSettingsFor(sourceProject, sourceWorkspace, null)).toMatchObject({
      projectId: "project_a",
      name: "项目 A",
      workspaceId: "workspace_a",
    });
    expect(editableProjectSettingsFor(sourceProject, sourceWorkspace, {
      projectId: "project_a",
      name: "草稿名",
      description: "草稿说明",
      taskStageMode: "regular",
      workspaceId: "workspace_b",
    })).toMatchObject({ name: "草稿名", workspaceId: "workspace_b" });
  });

  it("filters workspace options and project member tab visibility", () => {
    const shared = workspace({ id: "workspace_shared", type: "shared" });
    const privateWorkspace = workspace({ id: "workspace_private", type: "private" });

    expect(projectWorkspaceOptions([shared, privateWorkspace], undefined, "workspace_shared").map((item) => item.id)).toEqual(["workspace_shared"]);
    expect(projectWorkspaceTagLabel(privateWorkspace)).toBe("私人工作区 · 工作区 A");
    expect(canShowProjectMemberManagementFor({ canManageProjectMembers: true, workspace: privateWorkspace })).toBe(false);
    expect(projectDetailActiveTabFor("members", false)).toBe("overview");
  });

  it("builds task status update patches", () => {
    expect(projectTaskStatusPatch("completed", task(), "member_a", now)).toMatchObject({
      status: "completed",
      completedAt: now,
    });
    expect(projectTaskStatusPatch("pending_review", task(), "member_a", now)).toMatchObject({
      status: "pending_review",
      reviewSubmittedAt: now,
      reviewSubmittedByMemberId: "member_a",
    });
  });
});
