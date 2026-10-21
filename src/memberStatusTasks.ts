import { stageTaskSortRank } from "./projectTaskDisplay";
import type { MemberProjectTaskGroup, MemberStatusPerson } from "./memberStatusTypes";
import type { ProjectMember, Task } from "./types";

const memberProjectRoleLabel = (members: ProjectMember[], projectId: string) => {
  const projectMember = members.find((member) => member.projectId === projectId);
  if (!projectMember) return "成员";
  if (projectMember.roles.includes("project_owner")) return "项目负责人";
  return projectMember.roles.includes("executor") ? "执行者" : "成员";
};

export const groupMemberTasksByProject = (
  member: MemberStatusPerson,
  tasks: Task[],
  projectNameById: Map<string, string>,
  workspaceNameByProjectId: Map<string, string>,
): MemberProjectTaskGroup[] => {
  const groups = new Map<string, MemberProjectTaskGroup>();
  const ensureGroup = (projectId: string, fallbackName?: string) => {
    const existing = groups.get(projectId);
    if (existing) {
      if (fallbackName && existing.tasks.length === 0) existing.projectName = fallbackName;
      return existing;
    }
    const group = {
      projectId,
      projectName: projectNameById.get(projectId) ?? fallbackName ?? "未归属项目",
      workspaceName: workspaceNameByProjectId.get(projectId),
      roleLabel: memberProjectRoleLabel(member.members, projectId),
      tasks: [],
    };
    groups.set(projectId, group);
    return group;
  };

  member.projectIds.forEach((projectId) => ensureGroup(projectId));
  tasks.forEach((task) => ensureGroup(task.projectId || task.project || "unknown_project", task.project).tasks.push(task));
  return Array.from(groups.values());
};

export const taskBelongsToMemberStatusPerson = (task: Task, member: MemberStatusPerson, memberIds: Set<string>) => {
  const assignedIds = [task.primaryExecutorMemberId, ...(task.collaboratorMemberIds ?? [])];
  return member.members.some((binding) => binding.projectId === task.projectId &&
    memberIds.has(binding.id) && assignedIds.includes(binding.id));
};

export const sortMemberStatusTasks = (tasks: Task[], runningTask?: Task) =>
  [...tasks].sort((left, right) => {
    if (left.id === runningTask?.id) return -1;
    if (right.id === runningTask?.id) return 1;
    const statusDelta = stageTaskSortRank(left.status, false, true) - stageTaskSortRank(right.status, false, true);
    if (statusDelta !== 0) return statusDelta;
    return left.sortOrder - right.sortOrder;
  });
