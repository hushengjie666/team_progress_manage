import type { ProjectMember, Task, TaskStatus } from "./types";
import type { ProjectOverviewTaskBoard, ProjectOverviewTaskGroup } from "./projectDetailTypes";

export const buildProjectOverviewTaskBoard = (
  tasks: Task[],
  members: ProjectMember[],
  activeTaskIds?: string | Iterable<string>,
  todayTaskIds: Iterable<string> = [],
): ProjectOverviewTaskBoard => {
  const visibleTasks = tasks.filter((task) => task.status !== "completed" && task.status !== "split" && task.status !== "archived");
  const poolTasks = visibleTasks.filter((task) => task.status === "pool" || task.status === "committed");
  const pendingReviewTasks = visibleTasks.filter((task) => task.status === "pending_review");
  const inProgressTasks = visibleTasks.filter((task) => task.status === "in_progress");
  const activeTaskIdSet = typeof activeTaskIds === "string" ? new Set([activeTaskIds]) : new Set(activeTaskIds ?? []);
  const todayTaskIdSet = new Set(todayTaskIds);
  const todayWorkTasks = visibleTasks.filter((task) => todayTaskIdSet.has(task.id) || activeTaskIdSet.has(task.id));
  const membersById = new Map(members.map((member) => [member.id, member]));
  const memberOrder = new Map(members.map((member, index) => [member.id, index]));
  const groupsByKey = new Map<string, ProjectOverviewTaskGroup>();

  members.forEach((member) => {
    groupsByKey.set(member.id, {
      memberId: member.id,
      memberName: member.name,
      tasks: [],
      hasActiveTask: false,
    });
  });

  todayWorkTasks.forEach((task) => {
    const member = task.primaryExecutorMemberId ? membersById.get(task.primaryExecutorMemberId) : undefined;
    const key = member?.id ?? "__unassigned";
    const existing = groupsByKey.get(key);
    const group =
      existing ??
      {
        memberId: member?.id,
        memberName: member?.name ?? "未分配",
        tasks: [],
        hasActiveTask: false,
      };
    group.tasks.push(task);
    group.hasActiveTask = group.hasActiveTask || activeTaskIdSet.has(task.id);
    groupsByKey.set(key, group);
  });

  const statusOrder: Record<TaskStatus, number> = {
    in_progress: 0,
    committed: 1,
    pending_review: 2,
    pool: 3,
    completed: 4,
    split: 5,
    archived: 6,
  };
  const todayWorkGroups = [...groupsByKey.values()].map((group) => ({
    ...group,
    tasks: [...group.tasks].sort((left, right) => {
      if (activeTaskIdSet.has(left.id) && !activeTaskIdSet.has(right.id)) return -1;
      if (activeTaskIdSet.has(right.id) && !activeTaskIdSet.has(left.id)) return 1;
      const statusDelta = statusOrder[left.status] - statusOrder[right.status];
      if (statusDelta !== 0) return statusDelta;
      return left.sortOrder - right.sortOrder;
    }),
  })).sort((left, right) => {
    if (left.hasActiveTask !== right.hasActiveTask) return left.hasActiveTask ? -1 : 1;
    if (left.tasks.length !== right.tasks.length) return right.tasks.length - left.tasks.length;
    const leftOrder = left.memberId ? memberOrder.get(left.memberId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const rightOrder = right.memberId ? memberOrder.get(right.memberId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  return { poolTasks, pendingReviewTasks, inProgressTasks, todayWorkGroups };
};
