import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "../../types";
import { ProjectDetailMembersTab } from "./ProjectDetailMembersTab";

const now = "2026-07-01T00:00:00.000Z";

const project: Project = {
  id: "project_private",
  workspaceId: "workspace_private",
  name: "私人项目",
  description: "",
  defaultExpectedStartHours: 24,
  taskStageMode: "software",
  createdAt: now,
  updatedAt: now,
};

describe("ProjectDetailMembersTab", () => {
  it("shows private project member guidance without rendering the invite modal", () => {
    const html = renderToStaticMarkup(
      <ProjectDetailMembersTab
        project={project}
        isPrivateProject
        canManageProjectMembers
        memberOverviewStats={[]}
        accessibleProjectMembers={[]}
        showAddMemberDialog
        openAddMemberDialog={vi.fn()}
        closeAddMemberDialog={vi.fn()}
        inviteProjectMember={vi.fn()}
        updateMemberRole={vi.fn()}
        updateProjectMember={vi.fn()}
      />,
    );

    expect(html).toContain("私人项目不允许邀请其他人员");
    expect(html).not.toContain("邀请成员");
    expect(html).toContain("disabled");
  });
});
