import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { businessRowKey, businessRowsFromState } from "./teamBusinessRows";
import { businessOperationsBetween, operationsWithLatestRevisions } from "./teamBusinessMutations";

const versionedState = () => {
  const state = createInitialState();
  return {
    ...state,
    backend: {
      ...state.backend,
      businessRowRevisions: Object.fromEntries(businessRowsFromState(state).map((row) => [businessRowKey(row), 3])),
    },
  };
};

describe("team business mutations", () => {
  it("emits only the changed row instead of a snapshot", () => {
    const before = versionedState();
    const project = before.projects[0];
    const after = {
      ...before,
      projects: before.projects.map((item) => item.id === project.id ? { ...item, name: "并发安全项目", updatedAt: "2026-07-11T01:00:00.000Z" } : item),
    };

    expect(businessOperationsBetween(before, after)).toEqual([expect.objectContaining({
      operation: "patch",
      id: project.id,
      expected_revision: 3,
      patch: expect.objectContaining({ name: "并发安全项目" }),
    })]);
  });

  it("emits an explicit versioned delete only for a removed row", () => {
    const before = versionedState();
    const removed = before.projects[0];
    const after = { ...before, projects: before.projects.filter((project) => project.id !== removed.id) };
    const operations = businessOperationsBetween(before, after);

    expect(operations).toContainEqual(expect.objectContaining({
      operation: "delete",
      id: removed.id,
      expected_revision: 3,
    }));
    expect(operations.filter((operation) => operation.operation === "delete")).toHaveLength(1);
  });

  it("rebases patch revisions without making deletes retryable", () => {
    const before = versionedState();
    const project = before.projects[0];
    const after = {
      ...before,
      projects: before.projects.map((item) => item.id === project.id ? { ...item, name: "重放字段", updatedAt: "2026-07-11T01:01:00.000Z" } : item),
    };
    const operations = businessOperationsBetween(before, after);
    const key = businessRowKey(businessRowsFromState(before).find((row) => row.entity === "project" && row.id === project.id)!);
    const latest = { ...before, backend: { ...before.backend, businessRowRevisions: { ...before.backend.businessRowRevisions, [key]: 7 } } };

    expect(operationsWithLatestRevisions(operations, latest)[0]).toEqual(expect.objectContaining({ expected_revision: 7 }));
  });
});
