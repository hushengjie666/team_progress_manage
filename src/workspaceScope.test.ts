import { describe, expect, it } from "vitest";
import { createInitialState, withProject } from "./test/fixtures";
import {
  filterProjectItemsForWorkspace,
  mergeScopedProjectOrder,
  projectIdsForWorkspace,
  validWorkspaceSelection,
} from "./workspaceScope";

describe("workspace scope", () => {
  it("treats an empty selection as unrestricted and validates selected workspaces", () => {
    const state = createInitialState();
    const workspaces = state.auth.workspaces ?? [];

    expect(projectIdsForWorkspace(state, null)).toEqual(new Set(state.projects.map((project) => project.id)));
    expect(validWorkspaceSelection(workspaces, workspaces[0]?.id ?? null)).toBe(workspaces[0]?.id ?? null);
    expect(validWorkspaceSelection(workspaces, "workspace_missing")).toBeNull();
  });

  it("filters project-linked items by the selected workspace", () => {
    const state = createInitialState();
    const firstWorkspaceId = "workspace_first";
    const scopedState = {
      ...state,
      projects: state.projects.map((project) => ({ ...project, workspaceId: firstWorkspaceId })),
    };
    const next = withProject(scopedState, {
      id: "project_other_workspace",
      workspaceId: "workspace_other",
    });
    const projectIds = projectIdsForWorkspace(next, firstWorkspaceId);

    expect(projectIds).toContain(state.projects[0].id);
    expect(projectIds).not.toContain("project_other_workspace");
    expect(filterProjectItemsForWorkspace([
      { projectId: state.projects[0].id, value: "visible" },
      { projectId: "project_other_workspace", value: "hidden" },
    ], projectIds)).toEqual([{ projectId: state.projects[0].id, value: "visible" }]);
  });

  it("reorders scoped projects without moving projects outside the scope", () => {
    const allProjectIds = ["shared_a", "private_a", "shared_b", "private_b"];

    expect(mergeScopedProjectOrder(
      allProjectIds,
      ["shared_a", "shared_b"],
      ["shared_b", "shared_a"],
    )).toEqual(["shared_b", "private_a", "shared_a", "private_b"]);
  });
});
