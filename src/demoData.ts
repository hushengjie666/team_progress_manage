import { createDemoState } from "./demoDataState";
import {
  cloneDemoDailyPlansForProject,
  cloneDemoFocusSessionsForProject,
  cloneDemoInterruptionsForProject,
  mergeDemoDailyPlans,
} from "./demoDataEntityMerge";
import { cloneDemoTasksForProject } from "./demoDataTaskMerge";
import { appendUnique, upsertById } from "./demoDataMergeUtils";
import type { AppState } from "./types";

export { demoTaskIdForProject } from "./demoDataMergeUtils";

export const mergeDemoDataIntoState = (current: AppState, targetProjectId?: string, timestamp = new Date().toISOString()): AppState => {
  const targetProject = current.projects.find((project) => project.id === targetProjectId) ?? current.projects[0];
  if (!targetProject) return current;

  const demo = createDemoState();
  const projectId = targetProject.id;
  const workspaceId = targetProject.workspaceId ?? current.auth.workspace?.id;
  const tasks = cloneDemoTasksForProject({
    current,
    demoTasks: demo.tasks,
    targetProject,
    workspaceId,
    timestamp,
  });
  const focusSessions = cloneDemoFocusSessionsForProject({
    focusSessions: demo.focusSessions,
    projectId,
    workspaceId,
  });
  const interruptions = cloneDemoInterruptionsForProject({
    interruptions: demo.interruptions,
    projectId,
    workspaceId,
  });
  const demoPlans = cloneDemoDailyPlansForProject({
    dailyPlans: demo.dailyPlans,
    projectId,
    workspaceId,
    timestamp,
  });

  return {
    ...current,
    tasks: upsertById(current.tasks, tasks),
    dailyPlans: mergeDemoDailyPlans(current.dailyPlans, demoPlans, timestamp),
    focusSessions: upsertById(current.focusSessions, focusSessions),
    interruptions: upsertById(current.interruptions, interruptions),
    rewardState: {
      ...current.rewardState,
      badges: appendUnique(current.rewardState.badges, demo.rewardState.badges),
    },
    updatedAt: timestamp,
  };
};
