import { describe, expect, it } from "vitest";
import { todayKey } from "./seed";
import { createInitialState } from "./test/fixtures";
import { startTimerInState } from "./appModel";
import { deriveProjectDetailModel } from "./projectDetail";
import type { AppState } from "./types";

describe("project detail active timer model", () => {
  it("marks project detail tasks active from the local active timer even before work session repair", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
            "session_project_active_timer",
    );
    const inconsistent: AppState = {
      ...started,
      workSessions: [],
    };

    const model = deriveProjectDetailModel(inconsistent, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(model?.activeProjectTaskIds).toContain(taskId);
  });

  it("does not mark pending-review project tasks active from stale runtime state", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
            "session_pending_review_runtime",
    );
    const inconsistent: AppState = {
      ...started,
      tasks: started.tasks.map((task) => task.id === taskId ? { ...task, status: "pending_review" as const } : task),
    };

    const model = deriveProjectDetailModel(inconsistent, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(model?.activeProjectTaskIds).not.toContain(taskId);
  });

  it("does not mark completed project tasks active from stale runtime state", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      `${todayKey()}T08:00:00.000Z`,
            "session_completed_runtime",
    );
    const inconsistent: AppState = {
      ...started,
      tasks: started.tasks.map((task) => task.id === taskId ? { ...task, status: "completed" as const } : task),
    };

    const model = deriveProjectDetailModel(inconsistent, projectId, {
      query: "",
      status: "all",
      executor: "all",
      priority: "all",
      sort: "status",
    });

    expect(model?.activeProjectTaskIds).not.toContain(taskId);
  });
});
