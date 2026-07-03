import { describe, expect, it } from "vitest";
import { nextProjectMemberRoles } from "./projectDetailMemberRoleActions";

describe("project detail member role actions", () => {
  it("adds project owner without replacing executor", () => {
    expect(nextProjectMemberRoles(["executor"], "project_owner", true)).toEqual(["executor", "project_owner"]);
  });

  it("keeps at least one role when project owner is removed", () => {
    expect(nextProjectMemberRoles(["project_owner"], "project_owner", false)).toEqual(["executor"]);
  });
});
