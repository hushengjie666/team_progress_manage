import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProjectAccessibleMember } from "../../projectDetail";
import { ProjectMemberBindingPanel } from "./ProjectMemberBindingPanel";

const now = "2026-07-01T00:00:00.000Z";

describe("ProjectMemberBindingPanel", () => {
  it("renders direct project members and inherited workspace members together", () => {
    const accessibleMembers: ProjectAccessibleMember[] = [
      {
        id: "project_member_owner",
        identityKey: "account:account_owner",
        name: "胡圣杰",
        email: "hushengjie",
        source: "project",
        sourceLabel: "项目成员",
        roles: ["project_owner", "executor"],
        projectMember: {
          id: "project_member_owner",
          workspaceId: "workspace_shared",
          projectId: "project_1",
          accountId: "account_owner",
          name: "胡圣杰",
          email: "hushengjie",
          roles: ["project_owner", "executor"],
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        id: "workspace:account:account_wangshuo",
        identityKey: "account:account_wangshuo",
        name: "王硕",
        email: "wangshuo",
        source: "workspace",
        sourceLabel: "工作区成员",
        roles: ["executor"],
        workspaceMembership: {
          id: "membership_wangshuo",
          workspaceId: "workspace_shared",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          role: "member",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      },
    ];

    const html = renderToStaticMarkup(
      <ProjectMemberBindingPanel
        accessibleMembers={accessibleMembers}
        canManage
        updateMemberRole={vi.fn()}
        updateProjectMember={vi.fn()}
      />,
    );

    expect(html.match(/project-binding-row/g)?.length).toBe(2);
    expect(html).toContain("胡圣杰");
    expect(html).toContain("王硕");
    expect(html).toContain("工作区成员");
    expect(html).toContain("项目负责人");
    expect(html).toContain("执行者");
    expect(html).toContain("工作区授权");
  });
});
