import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceMemberListPanel } from "./WorkspaceMemberListPanel";

const selectedCard = {
  workspace: {
    id: "workspace_shared",
    name: "协作空间",
    type: "shared" as const,
    ownerAccountId: "account_owner",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  },
  projects: [],
  taskCount: 0,
  pendingReviewCount: 0,
  riskCount: 0,
  memberCount: 1,
  progressPercent: 0,
};

describe("WorkspaceMemberListPanel", () => {
  it("does not expose the invitation form to a member without management permission", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceMemberListPanel
        selectedCard={selectedCard}
        currentAccount={{
          id: "account_member",
          workspaceId: "workspace_shared",
          name: "普通成员",
          email: "member.qa.test",
          createdAt: "2026-07-17T00:00:00.000Z",
          updatedAt: "2026-07-17T00:00:00.000Z",
        }}
        selectedMembers={[]}
        selectedWorkspaceType="shared"
        selectedOwnerAccountId="account_owner"
        selectedMemberDraft={{ email: "" }}
        canManageSelectedWorkspaceMembers={false}
        canChangeSelectedWorkspaceOwner={false}
        updateWorkspaceMemberRole={vi.fn()}
        updateWorkspaceMemberDraft={vi.fn()}
        inviteWorkspaceMember={vi.fn()}
        unbindWorkspaceMember={vi.fn()}
      />,
    );

    expect(markup).toContain("当前账号没有成员邀请权限。");
    expect(markup).not.toContain("成员登录账号");
    expect(markup).not.toContain("发送邀请");
  });
});
