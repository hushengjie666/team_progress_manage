import { todayKey } from "../../../src/seed";
import { withExecutionSignal, withWorkSession } from "../../../src/test/fixtures";
import { authenticatedState } from "./authenticatedState";

export function weeklyFocusSample(today: string) {
  let state = authenticatedState();
  const stamp = (offset: number, clock: string) => {
    const date = new Date(today + "T12:00:00");
    date.setDate(date.getDate() + offset);
    return todayKey(date) + "T" + clock;
  };
  const privateId = state.auth.workspaces!.find((item) => item.type === "private")!.id;
  const project = { ...state.projects[0], id: "personal_project", workspaceId: privateId, name: "私人项目" };
  const task = { ...state.tasks[0], id: "personal_task", projectId: project.id, workspaceId: privateId };
  state.projects.push(project);
  state.tasks.push(task);

  const start = stamp(-3, "23:30:00");
  const end = stamp(-2, "01:00:00");
  state = withWorkSession(state, { id: "across", focusSessionId: "focus_across", startedAt: start, endedAt: end, totalPausedSeconds: 1800 });
  state.focusSessions.push({ id: "focus_across", taskId: state.tasks[0].id, startedAt: start, endedAt: end, mode: "focus",
    duration: 7200, outcome: "aborted", interruptionCounts: { internal: 0, external: 0 } });
  state.workSessions.push({ ...state.workSessions[0] });
  for (const [type, createdAt] of [
    ["work_started", start], ["work_paused", stamp(-3, "23:50:00")],
    ["work_resumed", stamp(-2, "00:20:00")], ["work_ended", end],
  ] as const) state = withExecutionSignal(state, { id: type, type, createdAt, workSessionId: "across" });

  state = withWorkSession(state, { id: "legacy", startedAt: stamp(-6, "23:30:00"), endedAt: stamp(-5, "01:00:00"), totalPausedSeconds: 900 });
  state = withWorkSession(state, { id: "private", taskId: task.id, startedAt: stamp(-1, "09:00:00"), endedAt: stamp(-1, "09:25:00") });
  state = withWorkSession(state, { id: "colleague", ownerAccountId: "account_wangshuo", executorMemberId: undefined,
    startedAt: stamp(-2, "10:00:00"), endedAt: stamp(-2, "10:07:00") });
  state.focusSessions.push({ ...state.focusSessions[0], id: "rest", mode: "short_break", duration: 300 });
  return state;
}
