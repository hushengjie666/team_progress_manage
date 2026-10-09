import { describe, expect, it, vi } from "vitest";
import { createAppProjectActionsRuntime } from "./appProjectActionsRuntime";
import { createProjectTaskInState } from "./projectDetail";
import { businessRowsFromState, mergeBusinessRowsIntoState, mergeBusinessRowChangesIntoState } from "./teamBusinessRows";
import { createTestState, teamBootstrapPayload } from "./test/fixtures";
import type { RunTeamDomainCommand } from "./teamDomainCommands";

describe("project creation identity", () => {
  it("keeps task member references valid before acknowledgement and after another client loads", () => {
    const source = createTestState();
    const { account } = teamBootstrapPayload(source);
    source.auth = { ...source.auth, status: "authenticated", account: {
      id: account.id, workspaceId: account.workspace_id, name: account.name, email: account.email,
      createdAt: account.created_at, updatedAt: account.updated_at,
    } };
    const runTeamCommand = vi.fn<RunTeamDomainCommand>(() => new Promise(() => {}));
    const runtime = createAppProjectActionsRuntime({
      getState: () => source,
      runTeamCommand,
      setToast: vi.fn(),
    });
    runtime.createProject("New project", "Description", source.auth.workspace?.id, "software");
    const [command, behavior] = runTeamCommand.mock.calls[0];
    expect(command.kind).toBe("create");
    if (command.kind !== "create") throw new Error("Expected a project create command");
    const optimistic = behavior!.optimistic!(source).next;
    const project = optimistic.projects.find((item) => item.id === command.payload.id)!;
    const serverMemberId = `member_${project.id}_${source.auth.account!.id}`;
    const withTask = createProjectTaskInState(optimistic, project.id, {
      title: "Created immediately", primaryExecutorMemberId: serverMemberId,
    }, "2026-10-09T10:00:00Z", (prefix) => `${prefix}_immediate`);
    const task = withTask.tasks.find((item) => item.projectId === project.id)!;
    const member = optimistic.projectMembers.find((item) => item.projectId === project.id)!;
    const serverRows = businessRowsFromState({ ...source, projects: [project], projectMembers: [{
      ...member, id: serverMemberId, updatedAt: "2026-10-09T10:01:00Z",
    }], tasks: [task] });
    const acknowledged = mergeBusinessRowChangesIntoState(withTask, serverRows);
    const reloaded = mergeBusinessRowsIntoState(source, serverRows);
    for (const state of [withTask, acknowledged, reloaded]) {
      const owners = state.projectMembers.filter((item) => item.projectId === project.id);
      expect(owners).toHaveLength(1);
      expect(owners[0].id).toBe(task.creatorMemberId);
      expect(owners[0].id).toBe(task.primaryExecutorMemberId);
    }
  });
});
