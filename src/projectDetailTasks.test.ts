import { describe, expect, it } from "vitest";
import { createInitialState } from "./test/fixtures";
import { createProjectInState } from "./teamProgress";
import { createProjectTaskInState, projectTasksForProject } from "./projectDetail";

describe("project detail tasks", () => {
  it("returns only one project's tasks and includes archived tasks by default", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "第二项目",
      "",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_second`,
    );
    const withFirstTask = createProjectTaskInState(
      withSecondProject,
      firstProjectId,
      { title: "当前项目归档任务" },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_first`,
    );
    const withArchivedFirstTask = {
      ...withFirstTask,
      tasks: withFirstTask.tasks.map((task) =>
        task.id === "task_first" ? { ...task, status: "archived" as const } : task,
      ),
    };
    const withOtherTask = createProjectTaskInState(
      withArchivedFirstTask,
      "project_second",
      { title: "其他项目任务" },
      "2026-05-10T11:00:00.000Z",
      (prefix) => `${prefix}_other`,
    );

    const tasks = projectTasksForProject(withOtherTask, firstProjectId);

    expect(tasks.every((task) => task.projectId === firstProjectId)).toBe(true);
    expect(tasks.some((task) => task.title === "当前项目归档任务" && task.status === "archived")).toBe(true);
    expect(tasks.some((task) => task.title === "其他项目任务")).toBe(false);
  });

  it("creates project detail tasks in the current project", () => {
    const state = createInitialState();
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      { title: "项目详情页新任务", estimatePomodoros: 3 },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_detail`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_detail",
      title: "项目详情页新任务",
      projectId: project.id,
      project: project.name,
      estimatePomodoros: 3,
      status: "pool",
    });
  });

  it("creates project detail tasks with regular task stages", () => {
    const state = createInitialState();
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      { title: "常规规划任务", stage: "planning" },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_regular`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_regular",
      title: "常规规划任务",
      stage: "planning",
    });
  });

  it("converts project detail estimate hours to pomodoros when creating tasks", () => {
    const baseState = createInitialState();
    const state = { ...baseState, settings: { ...baseState.settings, focusMinutes: 25 } };
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      { title: "小时估算任务", estimateHours: 1 },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_hours`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_hours",
      title: "小时估算任务",
      estimatePomodoros: 3,
    });
  });

  it("creates project detail tasks with full planning and collaboration fields", () => {
    const state = createInitialState();
    const project = state.projects[0];
    const next = createProjectTaskInState(
      state,
      project.id,
      {
        title: "完整字段任务",
        notes: "补充说明",
        tags: ["需求", "前端"],
        priority: "high",
        severity: "very_high",
        stage: "development",
        estimatePomodoros: 5,
        primaryExecutorMemberId: "member_owner",
        collaboratorMemberIds: ["member_executor", "member_owner"],
        expectedStartAt: "2026-05-10T10:00:00.000Z",
        expectedFinishAt: "2026-05-11T10:00:00.000Z",
        dueAt: "2026-05-12T10:00:00.000Z",
        reminderAt: "2026-05-12T09:00:00.000Z",
        repeatRule: "interval",
        repeatIntervalDays: 3,
        subtasks: ["拆第一步", "拆第二步"],
      },
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_full`,
    );

    expect(next.tasks[0]).toMatchObject({
      id: "task_full",
      title: "完整字段任务",
      notes: "补充说明",
      tags: ["需求", "前端"],
      priority: "high",
      severity: "very_high",
      stage: "development",
      estimatePomodoros: 5,
      primaryExecutorMemberId: "member_owner",
      collaboratorMemberIds: ["member_executor"],
      expectedStartAt: "2026-05-10T10:00:00.000Z",
      expectedFinishAt: "2026-05-11T10:00:00.000Z",
      dueAt: "2026-05-12T10:00:00.000Z",
      reminderAt: "2026-05-12T09:00:00.000Z",
      repeatRule: "interval",
      repeatIntervalDays: 3,
    });
    expect(next.tasks[0].subtasks.map((subtask) => subtask.title)).toEqual(["拆第一步", "拆第二步"]);
  });
});
