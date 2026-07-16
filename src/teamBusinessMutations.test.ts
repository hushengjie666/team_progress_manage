import { describe, expect, it } from "vitest";
import { ensureTodayPlan } from "./appModel";
import { createInitialState } from "./seed";
import { businessRowKey, businessRowsFromState } from "./teamBusinessRows";
import {
  businessOperationsBetween,
  rebaseBusinessOperations,
} from "./teamBusinessMutations";

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

  it("replays only the local patch over the latest server revision", () => {
    const before = ensureTodayPlan(versionedState());
    const plan = before.dailyPlans[0];
    const key = businessRowKey(businessRowsFromState(before).find((row) => row.entity === "daily_plan" && row.id === plan.id)!);
    const after = {
      ...before,
      dailyPlans: before.dailyPlans.map((item) => item.id === plan.id
        ? { ...item, committedTaskIds: [...item.committedTaskIds, "task_new"], updatedAt: "2026-07-15T01:00:00.000Z" }
        : item),
    };
    const latest = {
      ...before,
      dailyPlans: before.dailyPlans.map((item) => item.id === plan.id
        ? { ...item, capacityPomodoros: 12, updatedAt: "2026-07-15T00:59:00.000Z" }
        : item),
      backend: { ...before.backend, businessRowRevisions: { ...before.backend.businessRowRevisions, [key]: 9 } },
    };

    expect(rebaseBusinessOperations(before, after, latest)).toEqual([expect.objectContaining({
      operation: "patch",
      entity: "daily_plan",
      id: plan.id,
      expected_revision: 9,
      patch: expect.objectContaining({
        committedTaskIds: [...plan.committedTaskIds, "task_new"],
      }),
    })]);
  });

  it("turns a colliding local create into a patch of the server row", () => {
    const before = versionedState();
    const project = {
      ...before.projects[0],
      id: "project_concurrent_create",
      name: "本地名称",
      updatedAt: "2026-07-15T01:00:00.000Z",
    };
    const after = { ...before, projects: [...before.projects, project] };
    const serverProject = { ...project, name: "服务器名称", updatedAt: "2026-07-15T00:59:00.000Z" };
    const latestBase = { ...before, projects: [...before.projects, serverProject] };
    const key = businessRowKey(businessRowsFromState(latestBase).find((row) => row.entity === "project" && row.id === project.id)!);
    const latest = {
      ...latestBase,
      backend: { ...before.backend, businessRowRevisions: { ...before.backend.businessRowRevisions, [key]: 4 } },
    };

    expect(rebaseBusinessOperations(before, after, latest)).toEqual([expect.objectContaining({
      operation: "patch",
      id: project.id,
      expected_revision: 4,
      patch: expect.objectContaining({ name: "本地名称" }),
    })]);
  });
});
