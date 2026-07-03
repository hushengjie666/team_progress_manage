import { todayKey } from "./seed";
import type { AppState, DailyPlan, PlanPressure, Task, TaskSuggestion } from "./types";
import {
  interruptionsOnDate,
  planForDate,
} from "./domainQueries";

export const planCapacityHint = (state: AppState, date = todayKey()) => {
  const history = state.dailyPlans
    .filter((plan) => plan.date !== date)
    .slice(-7)
    .map((plan) => plan.completedPomodoros)
    .filter((value) => value > 0);
  if (!history.length) return state.rewardState.dailyGoal;
  return Math.max(1, Math.round(history.reduce((sum, value) => sum + value, 0) / history.length));
};

export const suggestedCapacity = (state: AppState, date = todayKey()) => {
  const base = planCapacityHint(state, date);
  const plan = planForDate(state, date);
  const interruptionPenalty = interruptionsOnDate(state, date).length >= 4 ? 1 : 0;
  const overloadPenalty = plan && plan.committedTaskIds.length > 0 && plan.completedPomodoros < plan.capacityPomodoros / 2 ? 1 : 0;
  return Math.max(1, base - interruptionPenalty - overloadPenalty);
};

const taskPriorityScore = (task: Task) =>
  task.priority === "urgent" ? 40 : task.priority === "high" ? 30 : task.priority === "medium" ? 20 : 10;

const dueScore = (task: Task, now = new Date()) => {
  if (!task.dueAt) return 0;
  const due = new Date(task.dueAt).getTime();
  if (Number.isNaN(due)) return 0;
  const days = Math.ceil((due - now.getTime()) / 86_400_000);
  if (days <= 0) return 28;
  if (days <= 1) return 22;
  if (days <= 3) return 14;
  if (days <= 7) return 8;
  return 2;
};

const estimateRiskScore = (task: Task) => {
  const recent = [...(task.estimateHistory ?? [])].slice(-3);
  const under = recent.filter((entry) => entry.actualPomodoros - entry.estimatedPomodoros >= 2).length;
  return under * 6 + (task.estimatePomodoros > 7 ? 10 : 0);
};

export const taskSuggestions = (state: AppState, date = todayKey(), limit = 5): TaskSuggestion[] => {
  const plan = planForDate(state, date);
  const committedIds = new Set(plan?.committedTaskIds ?? []);
  return [...state.tasks]
    .filter((task) => !committedIds.has(task.id) && (task.status === "pool" || task.status === "in_progress"))
    .map((task) => {
      const score = taskPriorityScore(task) + dueScore(task) + estimateRiskScore(task) - Math.max(0, task.estimatePomodoros - 3);
      const action: TaskSuggestion["action"] = task.estimatePomodoros > 7 ? "split" : score < 16 ? "defer" : "commit";
      const reasonParts = [
        task.priority === "urgent" ? "紧急" : task.priority === "high" ? "高优先级" : "",
        task.dueAt ? "临近到期" : "",
        task.estimatePomodoros > 7 ? "任务过大，建议先拆分" : "",
        estimateRiskScore(task) >= 6 ? "历史容易低估" : "",
      ].filter(Boolean);
      return {
        taskId: task.id,
        score,
        action,
        reason: reasonParts.join(" · ") || `估算 ${task.estimatePomodoros} 个番茄，适合补入今日`,
      };
    })
    .sort((left, right) => {
      const leftTask = state.tasks.find((task) => task.id === left.taskId);
      const rightTask = state.tasks.find((task) => task.id === right.taskId);
      return right.score - left.score || (leftTask?.sortOrder ?? 0) - (rightTask?.sortOrder ?? 0);
    })
    .slice(0, limit);
};

export const suggestedTasks = (state: AppState, limit = 5) =>
  taskSuggestions(state, todayKey(), limit)
    .filter((item) => item.action !== "defer")
    .map((item) => item.taskId);

export const planPressure = (state: AppState, plan: DailyPlan): PlanPressure => {
  const totalEstimate = plan.committedTaskIds
    .map((id) => state.tasks.find((task) => task.id === id))
    .filter((task): task is Task => Boolean(task))
    .reduce((sum, task) => sum + task.estimatePomodoros, 0);
  const remainingEstimate = Math.max(0, totalEstimate - plan.completedPomodoros);
  const overBy = Math.max(0, totalEstimate - plan.capacityPomodoros);
  if (overBy > 0) {
    return {
      level: "overloaded",
      label: "超载",
      detail: `工作队列超过容量 ${overBy} 个番茄，建议移出低优先级任务或拆分大任务。`,
      totalEstimate,
      remainingEstimate,
      overBy,
    };
  }
  if (totalEstimate <= Math.max(1, Math.floor(plan.capacityPomodoros * 0.65))) {
    return {
      level: "light",
      label: "轻松",
      detail: "工作队列低于建议容量，可以保留缓冲，或补入一个小任务。",
      totalEstimate,
      remainingEstimate,
      overBy,
    };
  }
  return {
    level: "balanced",
    label: "合适",
    detail: "工作队列和容量基本匹配，适合按顺序推进。",
    totalEstimate,
    remainingEstimate,
    overBy,
  };
};
