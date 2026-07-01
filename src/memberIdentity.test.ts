import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { resolveCurrentMember, resolveMemberIdForProject } from "./memberIdentity";
import type { ProjectMember } from "./types";

describe("member identity resolution", () => {
  it("uses the authenticated account instead of a stale currentMemberId", () => {
    const state = createInitialState();
    const owner = state.projectMembers[0];
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      teamMemberId: "team_member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const loggedInState = {
      ...state,
      currentMemberId: teammate.id,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: owner.accountId!,
          workspaceId: "workspace_test",
          name: owner.name,
          email: owner.email!,
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z",
        },
      },
      projectMembers: [teammate, owner],
    };

    expect(resolveCurrentMember(loggedInState)?.id).toBe(owner.id);
    expect(resolveMemberIdForProject(loggedInState, owner.projectId)).toBe(owner.id);
  });

  it("does not fall back to another project member when the authenticated account has no match", () => {
    const state = createInitialState();
    const otherMember = {
      ...state.projectMembers[0],
      accountId: "account_other",
      email: "other@example.com",
      name: "王硕",
    };
    const loggedInState = {
      ...state,
      currentMemberId: otherMember.id,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: "account_current",
          workspaceId: "workspace_test",
          name: "胡圣杰",
          email: "hushengjie@example.com",
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z",
        },
      },
      projectMembers: [otherMember],
    };

    expect(resolveCurrentMember(loggedInState)).toBeUndefined();
    expect(resolveMemberIdForProject(loggedInState, otherMember.projectId)).toBeUndefined();
  });
});
