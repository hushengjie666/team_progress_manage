import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { taskStageOptions, taskStageOptionsForMode, taskStageOptionsForTasks } from "./appTaskMetadata";
import { ProjectOverviewTaskBoard } from "./components/projectDetail/ProjectOverviewTaskBoard";
import { ScheduleTimelineBoard } from "./components/scheduleCalendar/ScheduleTimelineBoard";
import { addScheduleDays, buildScheduleMonthGroups, SCHEDULE_WINDOW_DAYS } from "./scheduleCalendar";
import { createInitialState } from "./test/fixtures";
import type { TaskStageMode } from "./types";

describe.each<TaskStageMode>(["regular", "software"])("project stage visibility in %s mode", (mode) => {
  const state = createInitialState();
  const tasks = taskStageOptions.map(({ value }, index) => ({
    ...state.tasks[0],
    id: `task_${value}`,
    title: `Task ${value}`,
    stage: value,
    status: "pool" as const,
    expectedStartAt: "2026-10-09T08:00:00.000Z",
    expectedFinishAt: "2026-10-10T08:00:00.000Z",
    sortOrder: index,
  }));

  it("keeps configured stages and includes only used additional stages without duplicates", () => {
    const configured = taskStageOptionsForMode(mode);
    expect(taskStageOptionsForTasks(mode, [])).toEqual(configured);
    const foreignStage = mode === "regular" ? "requirements" : "execution";
    const foreignTasks = tasks.filter((task) => task.stage === foreignStage);
    const options = taskStageOptionsForTasks(mode, [...foreignTasks, ...foreignTasks]);
    expect(options.map((option) => option.value)).toEqual([...configured.map((option) => option.value), foreignStage]);
  });

  it("renders every supplied task once in the overview, including stages outside the project mode", () => {
    const html = renderToStaticMarkup(<ProjectOverviewTaskBoard
      tasks={tasks}
      members={state.projectMembers}
      todayTaskIds={[]}
      activeTaskIds={[]}
      taskStageMode={mode}
      selectTask={() => {}}
    />);
    expect(html.match(/<button /g)).toHaveLength(tasks.length);
    for (const task of tasks) {
      expect(html.split(`<strong>${task.title}</strong>`)).toHaveLength(2);
    }
    for (const stage of taskStageOptions) {
      expect(html).toContain(`<strong>${stage.label}</strong><span>1</span>`);
    }
  });

  it("renders every scheduled task once on the timeline, including stages outside the project mode", () => {
    const windowStart = "2026-10-05";
    const days = Array.from({ length: SCHEDULE_WINDOW_DAYS }, (_, index) => addScheduleDays(windowStart, index));
    const html = renderToStaticMarkup(<ScheduleTimelineBoard
      days={days}
      monthGroups={buildScheduleMonthGroups(days)}
      windowStart={windowStart}
      scheduledTasks={tasks}
      members={state.projectMembers}
      todayTaskIds={new Set()}
      activeTaskIds={new Set()}
      taskStageMode={mode}
      openTask={() => {}}
    />);
    expect(html.match(/<button /g)).toHaveLength(tasks.length);
    for (const task of tasks) {
      expect(html).toContain(`class="schedule-task-title">${task.title}</span>`);
    }
    for (const stage of taskStageOptions) {
      expect(html).toContain(`<strong>${stage.label}</strong><span>1</span>`);
    }
  });
});
