import { todayKey } from "../../src/seed.js";
import type { AppState } from "../../src/types.js";
import { memberLabel } from "./coreProjectModel.js";
import { activeWorkSessionsForTasks, compactTask } from "./coreTaskModel.js";

export const todayPlanView = (state: AppState, date = todayKey()) => {
  const plan = state.dailyPlans.find((item) => item.date === date);
  const taskIds = new Set(plan?.committedTaskIds ?? []);
  return {
    date,
    plan,
    tasks: state.tasks.filter((task) => taskIds.has(task.id)).map((task) => compactTask(state, task)),
  };
};

export const todayWorkbenchView = (state: AppState, projectId?: string, date = todayKey()) => {
  const plan = state.dailyPlans.find((item) => item.date === date);
  const taskIds = new Set(plan?.committedTaskIds ?? []);
  const todayTasks = state.tasks
    .filter((task) => taskIds.has(task.id))
    .filter((task) => !projectId || task.projectId === projectId)
    .filter((task) => task.status !== "archived" && task.status !== "split");
  const projectMemberIds = new Set(todayTasks.map((task) => task.primaryExecutorMemberId).filter(Boolean) as string[]);
  const members = state.projectMembers.filter((member) => projectMemberIds.has(member.id));
  const activeSessions = activeWorkSessionsForTasks(state, todayTasks);
  const activeTaskIds = new Set(activeSessions.filter((session) => session.status === "active").map((session) => session.taskId));
  const groups = [...members, undefined].map((member) => {
    const tasks = todayTasks.filter((task) => (member ? task.primaryExecutorMemberId === member.id : !task.primaryExecutorMemberId));
    return {
      memberId: member?.id,
      memberName: memberLabel(member),
      taskCount: tasks.length,
      activeTaskCount: tasks.filter((task) => activeTaskIds.has(task.id)).length,
      tasks: tasks.map((task) => ({
        ...compactTask(state, task),
        isActive: activeTaskIds.has(task.id),
      })),
    };
  }).filter((group) => group.taskCount > 0);
  return {
    date,
    projectId,
    totalTaskCount: todayTasks.length,
    activeSessions,
    groups,
  };
};
