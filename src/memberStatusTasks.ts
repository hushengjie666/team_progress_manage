import { stageTaskSortRank } from "./projectTaskDisplay";
import type { MemberProjectTaskGroup, MemberStatusPerson } from "./memberStatusTypes";
import type { ProjectMember, Task } from "./types";

const memberProjectRoleLabel = (members: ProjectMember[], projectId: string) => {
  const projectMember = members.find((member) => member.projectId === projectId);
  if (!projectMember) return "成员";
  return projectMember.roles.includes("project_owner") ? "项目负责人" : "执行者";
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
  const collaboratorMemberIds = task.collaboratorMemberIds ?? [];
  const isExplicitlyAssigned = Boolean(
    (task.primaryExecutorMemberId && memberIds.has(task.primaryExecutorMemberId)) ||
    collaboratorMemberIds.some((memberId) => memberIds.has(memberId)),
  );
  const isUnassigned = !task.primaryExecutorMemberId && collaboratorMemberIds.length === 0;
  return isExplicitlyAssigned || (isUnassigned && member.roles.includes("project_owner") && member.projectIds.includes(task.projectId));
};

export const sortMemberStatusTasks = (tasks: Task[], runningTask?: Task) =>
  [...tasks].sort((left, right) => {
    if (left.id === runningTask?.id) return -1;
    if (right.id === runningTask?.id) return 1;
    const statusDelta = stageTaskSortRank(left.status, false, true) - stageTaskSortRank(right.status, false, true);
    if (statusDelta !== 0) return statusDelta;
    return left.sortOrder - right.sortOrder;
  });
