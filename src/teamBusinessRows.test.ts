import { describe, expect, it } from "vitest";
import { businessRowsFromState, mergeBusinessRowChangesIntoState } from "./teamBusinessRows";
import { createTestState } from "./test/fixtures";

describe("business delta merge", () => {
  it("is idempotent for repeated rows and deletion markers", () => {
    const source = createTestState();
    const task = source.tasks[0];
    const updated = { ...task, title: "服务端更新", updatedAt: "2026-08-19T04:00:00.000Z" };
    const row = businessRowsFromState({ ...source, tasks: [updated, ...source.tasks.slice(1)] })
      .find((item) => item.entity === "task" && item.id === task.id)!;

    const once = mergeBusinessRowChangesIntoState(source, [row]);
    const twice = mergeBusinessRowChangesIntoState(once, [row]);
    expect(twice.tasks.filter((item) => item.id === task.id)).toEqual([updated]);

    const deleted = mergeBusinessRowChangesIntoState(twice, [], [{
      workspace_id: row.workspace_id,
      account_id: row.account_id,
      entity: "task",
      id: task.id,
    }]);
    const deletedAgain = mergeBusinessRowChangesIntoState(deleted, [], [{
      workspace_id: row.workspace_id,
      entity: "task",
      id: task.id,
    }]);
    expect(deletedAgain.tasks.some((item) => item.id === task.id)).toBe(false);
  });
});
