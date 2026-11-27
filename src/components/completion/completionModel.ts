import { getTodayPlan } from "../../appTodayPlan";
import { filterTodayCompletedTasksForMember } from "../../myProjectTaskCards";
import type { AppState, Task } from "../../types";
import { committedTasksForPlan, currentMemberForState, focusTasksForMember } from "../../workbenchFocusModel";
import { projectIdsForWorkspace } from "../../workspaceScope";
import { buildFocusTaskList } from "../focus/focusModel";

export function completionSummary(id: string, before: Task[], saved: AppState, workspaceId: string | null) {
  const plan = getTodayPlan(saved);
  const member = currentMemberForState(saved);
  const projects = workspaceId ? projectIdsForWorkspace(saved, workspaceId) : undefined;
  const inScope = (task: Task) => !projects || projects.has(task.projectId);
  const planned = committedTasksForPlan(saved, plan).filter(inScope);
  const visible = buildFocusTaskList(focusTasksForMember(saved, planned, member));
  const allClear = before.some((task) => task.id === id && task.status !== "completed") &&
    visible.some((task) => task.id === id) && visible.every((task) => task.status === "completed");
  const doneToday = filterTodayCompletedTasksForMember(saved, plan.date, member, { includeUnassigned: true }).filter(inScope);
  // A project owner can also finish a task on behalf of another member.
  const achievedToday = new Set([id, ...doneToday.map((task) => task.id)]).size;
  return { allClear, plannedCount: visible.length, achievedToday };
}
