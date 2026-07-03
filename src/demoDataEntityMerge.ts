import type { DailyPlan, FocusSession, Interruption } from "./types";
import {
  appendUnique,
  demoEntityIdForProject,
  demoTaskIdForProject,
  mapDemoSessionId,
  mapDemoTaskId,
} from "./demoDataMergeUtils";

export const cloneDemoFocusSessionsForProject = ({
  focusSessions,
  projectId,
  workspaceId,
}: {
  focusSessions: FocusSession[];
  projectId: string;
  workspaceId?: string;
}): FocusSession[] =>
  focusSessions.map((session) => ({
    ...session,
    id: demoEntityIdForProject(session.id, projectId),
    workspaceId,
    taskId: mapDemoTaskId(session.taskId, projectId),
  }));

export const cloneDemoInterruptionsForProject = ({
  interruptions,
  projectId,
  workspaceId,
}: {
  interruptions: Interruption[];
  projectId: string;
  workspaceId?: string;
}): Interruption[] =>
  interruptions.map((interruption) => ({
    ...interruption,
    id: demoEntityIdForProject(interruption.id, projectId),
    workspaceId,
    sessionId: mapDemoSessionId(interruption.sessionId, projectId),
    taskId: mapDemoTaskId(interruption.taskId, projectId),
    convertedTaskId: mapDemoTaskId(interruption.convertedTaskId, projectId),
  }));

export const cloneDemoDailyPlansForProject = ({
  dailyPlans,
  projectId,
  workspaceId,
  timestamp,
}: {
  dailyPlans: DailyPlan[];
  projectId: string;
  workspaceId?: string;
  timestamp: string;
}): DailyPlan[] =>
  dailyPlans.map((plan) => ({
    ...plan,
    id: demoEntityIdForProject(plan.id, projectId),
    workspaceId,
    committedTaskIds: plan.committedTaskIds.map((taskId) => demoTaskIdForProject(taskId, projectId)),
    suggestedTaskIds: plan.suggestedTaskIds.map((taskId) => demoTaskIdForProject(taskId, projectId)),
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

export const mergeDemoDailyPlans = (
  currentDailyPlans: DailyPlan[],
  demoPlans: DailyPlan[],
  timestamp: string,
): DailyPlan[] => {
  const plansByDate = new Map(currentDailyPlans.map((plan) => [plan.date, plan]));
  return [
    ...currentDailyPlans.map((plan) => {
      const demoPlan = demoPlans.find((item) => item.date === plan.date);
      if (!demoPlan) return plan;
      return {
        ...plan,
        committedTaskIds: appendUnique(plan.committedTaskIds, demoPlan.committedTaskIds),
        suggestedTaskIds: appendUnique(plan.suggestedTaskIds, demoPlan.suggestedTaskIds),
        updatedAt: timestamp,
      };
    }),
    ...demoPlans.filter((plan) => !plansByDate.has(plan.date)),
  ].sort((left, right) => right.date.localeCompare(left.date));
};
