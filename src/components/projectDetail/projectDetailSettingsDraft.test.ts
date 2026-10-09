import { describe, expect, it } from "vitest";
import { reconcileProjectSettingsDraft, type ProjectSettingsDraft } from "./projectDetailControllerModel";

const original: ProjectSettingsDraft = {
  projectId: "project_test",
  name: "Original",
  description: "Original description",
  taskStageMode: "software",
  workspaceId: "workspace_test",
};

describe("project settings draft reconciliation", () => {
  it("keeps unsaved edits when the server acknowledges project creation", () => {
    const edited = { ...original, name: "User edit", taskStageMode: "regular" as const };
    const incoming = { ...original, description: "Server description" };
    expect(reconcileProjectSettingsDraft(edited, original, incoming)).toEqual({
      ...incoming, name: "User edit", taskStageMode: "regular",
    });
  });

  it("refreshes fields that the user has not edited", () => {
    const incoming = { ...original, name: "Remote update", workspaceId: "workspace_other" };
    expect(reconcileProjectSettingsDraft(original, original, incoming)).toEqual(incoming);
  });

  it("starts a fresh draft when switching projects", () => {
    const incoming = { ...original, projectId: "project_other", name: "Other" };
    expect(reconcileProjectSettingsDraft({ ...original, name: "Unsaved" }, original, incoming)).toEqual(incoming);
  });

  it("follows later server updates after the saved draft is acknowledged", () => {
    const edited = { ...original, name: "Saved", description: "Saved details" };
    const acknowledged = reconcileProjectSettingsDraft(edited, original, edited);
    const later = { ...edited, name: "Updated by teammate" };
    expect(reconcileProjectSettingsDraft(acknowledged, edited, later)).toEqual(later);
  });
});
