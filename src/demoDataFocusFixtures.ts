import type { FocusSession } from "./types";
import { makeDemoFocusSession } from "./demoDataBuilders";
import { demoHistoricalCompletedPomodoros, demoHistoricalTaskIds } from "./demoDataHistory";

const createGeneratedDemoSessions = () =>
  Array.from({ length: 18 }, (_, dayIndex) => {
    const offset = -(dayIndex + 1);
    const completedCount = demoHistoricalCompletedPomodoros[dayIndex];
    const sessionsForDay = Array.from({ length: completedCount }, (_, sessionIndex) =>
      makeDemoFocusSession(
        `demo_s_hist_${dayIndex}_${sessionIndex}`,
        demoHistoricalTaskIds[(dayIndex + sessionIndex) % demoHistoricalTaskIds.length],
        offset,
        9 + sessionIndex + (sessionIndex > 2 ? 1 : 0),
        "completed",
        sessionIndex === 1 && dayIndex % 3 === 0 ? 1 : 0,
        sessionIndex === 2 && dayIndex % 4 === 0 ? 1 : 0,
      ),
    );
    if (dayIndex % 5 === 1) {
      sessionsForDay.push(
        makeDemoFocusSession(`demo_s_hist_abort_${dayIndex}`, demoHistoricalTaskIds[dayIndex % demoHistoricalTaskIds.length], offset, 15, "aborted", 1, 1),
      );
    }
    return sessionsForDay;
  }).flat();

export const createDemoFocusSessions = (): FocusSession[] => [
  makeDemoFocusSession("demo_s_today_1", "demo_task_today_deep", 0, 9, "completed", 1, 0),
  makeDemoFocusSession("demo_s_y_1", "demo_task_done_prd", -1, 9),
  makeDemoFocusSession("demo_s_y_2", "demo_task_done_prd", -1, 10, "completed", 0, 1),
  makeDemoFocusSession("demo_s_y_3", "demo_task_done_prd", -1, 14),
  makeDemoFocusSession("demo_s_y_4", "demo_task_done_prd", -1, 15),
  makeDemoFocusSession("demo_s_2_1", "demo_task_pool_calendar", -2, 10),
  makeDemoFocusSession("demo_s_2_2", "demo_task_pool_calendar", -2, 11, "aborted", 2, 1),
  makeDemoFocusSession("demo_s_3_1", "demo_task_today_sync", -3, 9),
  makeDemoFocusSession("demo_s_4_1", "demo_task_today_report", -4, 16),
  makeDemoFocusSession("demo_s_5_1", "demo_task_today_deep", -5, 10, "completed", 1, 0),
  makeDemoFocusSession("demo_s_6_1", "demo_task_done_prd", -6, 15),
  ...createGeneratedDemoSessions(),
];
