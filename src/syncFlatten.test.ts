import { describe, expect, it } from "vitest";
import {
  flattenStateToChanges,
} from "./sync";
import { iso, teamState } from "./test/syncFixtures";
import type { AppState } from "./types";

describe("team progress sync flattening", () => {
  it("emits workspace ids for project-scoped changes", () => {
    const state = teamState();
    const workspaceId = "workspace_shared";
    const withWorkspace: AppState = {
      ...state,
      auth: {
        ...state.auth,
        workspace: {
          id: "workspace_private_account_sync",
          name: "私人工作区",
          type: "private",
          ownerAccountId: "account_sync",
          createdAt: state.updatedAt,
          updatedAt: state.updatedAt,
        },
        workspaces: [
          {
            id: "workspace_private_account_sync",
            name: "私人工作区",
            type: "private",
            ownerAccountId: "account_sync",
            createdAt: state.updatedAt,
            updatedAt: state.updatedAt,
          },
          {
            id: workspaceId,
            name: "协作区",
            type: "shared",
            ownerAccountId: "account_sync",
            createdAt: state.updatedAt,
            updatedAt: state.updatedAt,
          },
        ],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
    };

    const changes = flattenStateToChanges(withWorkspace);

    expect(changes.find((change) => change.entity === "project" && change.id === "project_sync")?.workspace_id).toBe(workspaceId);
    expect(changes.find((change) => change.entity === "task" && change.id === "task_sync")?.workspace_id).toBe(workspaceId);
    expect(changes.find((change) => change.entity === "work_session" && change.id === "work_session_sync")?.workspace_id).toBe(workspaceId);
    expect(changes.find((change) => change.entity === "execution_signal" && change.id === "signal_sync")?.workspace_id).toBe(workspaceId);
  });

  it("represents team progress entities in push payloads", () => {
    const state = teamState();
    const changes = flattenStateToChanges(state);
    const byKey = new Map(changes.map((change) => [`${change.entity}:${change.id}`, change]));

    expect(byKey.get("project:project_sync")?.payload).toMatchObject({ name: "同步项目" });
    expect(byKey.get("project_member:member_sync")?.payload).toMatchObject({ roles: ["project_owner", "executor"] });
    expect(byKey.get("task:task_sync")?.payload).toMatchObject({
      primaryExecutorMemberId: "member_sync",
      expectedStartAt: iso("2026-05-10T09:00:00Z"),
      expectedFinishAt: iso("2026-05-10T18:00:00Z"),
      progressPercent: 65,
      progressNote: "接口联调中",
      status: "pending_review",
      reviewSubmittedAt: iso("2026-05-10T16:30:00Z"),
    });
    expect(byKey.get("work_session:work_session_sync")?.payload).toMatchObject({ status: "active", executorMemberId: "member_sync" });
    expect(byKey.get("execution_signal:signal_sync")?.payload).toMatchObject({ type: "work_started", payload: { mode: "focus" } });
  });

  it("pushes only rows changed after the last successful sync when requested", () => {
    const state = teamState();
    const changed = {
      ...state,
      sync: {
        ...state.sync,
        tombstones: [
          { entity: "task", id: "task_old_deleted", deletedAt: iso("2026-05-10T16:20:00Z") },
          { entity: "task", id: "task_new_deleted", deletedAt: iso("2026-05-10T16:45:00Z") },
        ],
      },
      tasks: state.tasks.map((task) =>
        task.id === "task_sync"
          ? {
              ...task,
              progressPercent: 90,
              updatedAt: iso("2026-05-10T16:40:00Z"),
            }
          : task,
      ),
    };

    const changes = flattenStateToChanges(changed, { changedAfter: iso("2026-05-10T16:35:00Z") });
    const keys = changes.map((change) => `${change.entity}:${change.id}`);

    expect(keys).toContain("task:task_sync");
    expect(keys).toContain("task:task_new_deleted");
    expect(keys).not.toContain("project:project_sync");
    expect(keys).not.toContain("task:task_old_deleted");
  });

  it("still pushes active work sessions and their tasks when their timestamps are older than last sync", () => {
    const state = teamState();
    const changes = flattenStateToChanges(state, { changedAfter: iso("2026-05-10T16:35:00Z") });
    const keys = changes.map((change) => `${change.entity}:${change.id}`);

    expect(keys).toContain("work_session:work_session_sync");
    expect(keys).toContain("task:task_sync");
    expect(keys).not.toContain("project:project_sync");
  });
});
