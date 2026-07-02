import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { labelTaskStage, today } from "../appModel";
import {
  stageTaskSortRank,
  stageTaskStatusLabel,
} from "../projectTaskDisplay";
import {
  accessibleProjectIdsForCurrentUser,
  activeWorkspaceIdsForCurrentAccount,
  workspaceForProject,
  workspaceIdForProject,
  workspaceMembershipsForState,
} from "../accessControl";
import { projectToneClassName } from "../projectVisuals";
import type { AppState, ProjectMember, ProjectMemberRole, Task, WorkspaceMembership } from "../types";

export type MemberProjectTaskGroup = {
  projectId: string;
  projectName: string;
  workspaceName?: string;
  roleLabel: string;
  tasks: Task[];
};

export type MemberStatusPerson = {
  id: string;
  name: string;
  roles: ProjectMemberRole[];
  accountId?: string;
  email?: string;
  memberIds: string[];
  projectIds: string[];
  workspaceIds: string[];
  members: ProjectMember[];
  workspaceMemberships: WorkspaceMembership[];
};

type MemberStatusPersonDraft = MemberStatusPerson & {
  identityKeys: string[];
};

export type MemberStatusColumn = MemberStatusPerson & {
  displayedTasks: Task[];
  projectTaskGroups: MemberProjectTaskGroup[];
  runningTask?: Task;
};

const memberProjectRoleLabel = (members: ProjectMember[], projectId: string) => {
  const projectMember = members.find((member) => member.projectId === projectId);
  if (!projectMember) return "成员";
  return projectMember.roles.includes("project_owner") ? "项目负责人" : "执行者";
};

const groupMemberTasksByProject = (
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

const taskBelongsToMemberStatusPerson = (task: Task, member: MemberStatusPerson, memberIds: Set<string>) => {
  const collaboratorMemberIds = task.collaboratorMemberIds ?? [];
  const isExplicitlyAssigned = Boolean(
    (task.primaryExecutorMemberId && memberIds.has(task.primaryExecutorMemberId)) ||
    collaboratorMemberIds.some((memberId) => memberIds.has(memberId)),
  );
  const isUnassigned = !task.primaryExecutorMemberId && collaboratorMemberIds.length === 0;
  return isExplicitlyAssigned || (isUnassigned && member.roles.includes("project_owner") && member.projectIds.includes(task.projectId));
};

const normalizedEmail = (email?: string) => email?.trim().toLowerCase();

const memberStatusIdentityKeys = (identity: {
  id?: string;
  accountId?: string;
  email?: string;
}) => [
  identity.accountId ? `account:${identity.accountId}` : "",
  normalizedEmail(identity.email) ? `email:${normalizedEmail(identity.email)}` : "",
  identity.id ? `member:${identity.id}` : "",
].filter(Boolean);

const mergeIdentityKeys = (left: string[], right: string[]) => Array.from(new Set([...left, ...right]));

const findMemberStatusPerson = (people: MemberStatusPersonDraft[], keys: string[]) =>
  people.find((person) => keys.some((key) => person.identityKeys.includes(key)));

export const buildMemberStatusPeople = (
  projectMembers: ProjectMember[],
  workspaceMemberships: WorkspaceMembership[] = [],
): MemberStatusPerson[] => {
  const people: MemberStatusPersonDraft[] = [];

  workspaceMemberships
    .filter((membership) => membership.status === "active")
    .reduce<MemberStatusPersonDraft[]>((drafts, membership) => {
      const identityKeys = memberStatusIdentityKeys(membership);
      const existing = findMemberStatusPerson(drafts, identityKeys);
      if (!existing) {
        drafts.push({
          id: membership.accountId,
          name: membership.name,
          roles: [],
          accountId: membership.accountId,
          email: membership.email,
          memberIds: [],
          projectIds: [],
          workspaceIds: [membership.workspaceId],
          members: [],
          workspaceMemberships: [membership],
          identityKeys,
        });
        return drafts;
      }

      existing.name = existing.name || membership.name;
      existing.accountId = existing.accountId ?? membership.accountId;
      existing.email = existing.email ?? membership.email;
      existing.workspaceIds = Array.from(new Set([...existing.workspaceIds, membership.workspaceId]));
      existing.workspaceMemberships = [...existing.workspaceMemberships, membership];
      existing.identityKeys = mergeIdentityKeys(existing.identityKeys, identityKeys);
      return drafts;
    }, people);

  projectMembers.reduce<MemberStatusPersonDraft[]>((drafts, member) => {
    const identityKeys = memberStatusIdentityKeys(member);
    const existing = findMemberStatusPerson(drafts, identityKeys);
    if (!existing) {
      drafts.push({
        id: member.accountId ?? member.email ?? member.id,
        name: member.name,
        roles: member.roles,
        accountId: member.accountId,
        email: member.email,
        memberIds: [member.id],
        projectIds: [member.projectId],
        workspaceIds: [],
        members: [member],
        workspaceMemberships: [],
        identityKeys,
      });
      return drafts;
    }

    existing.roles = Array.from(new Set([...existing.roles, ...member.roles]));
    existing.accountId = existing.accountId ?? member.accountId;
    existing.email = existing.email ?? member.email;
    existing.memberIds = Array.from(new Set([...existing.memberIds, member.id]));
    existing.projectIds = Array.from(new Set([...existing.projectIds, member.projectId]));
    existing.members = [...existing.members, member];
    existing.identityKeys = mergeIdentityKeys(existing.identityKeys, identityKeys);
    return drafts;
  }, people);

  return people.map(({ identityKeys: _identityKeys, ...person }) => person);
};

export const buildMemberStatusColumns = (state: AppState, projectId?: string, date = today()): MemberStatusColumn[] => {
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state);
  const sourceProjectIds = projectId
    ? new Set(accessibleProjectIds.has(projectId) ? [projectId] : [])
    : accessibleProjectIds;
  const accessibleWorkspaceIds = activeWorkspaceIdsForCurrentAccount(state);
  const sourceWorkspaceIds = new Set(
    state.projects
      .filter((project) => sourceProjectIds.has(project.id))
      .map((project) => workspaceIdForProject(state, project))
      .filter((workspaceId): workspaceId is string => typeof workspaceId === "string" && accessibleWorkspaceIds.has(workspaceId)),
  );
  const sourceProjectMembers = state.projectMembers.filter((member) => sourceProjectIds.has(member.projectId) && member.status !== "disabled");
  const sourceWorkspaceMemberships = workspaceMembershipsForState(state).filter(
    (membership) => sourceWorkspaceIds.has(membership.workspaceId) && membership.status === "active",
  );
  const members = buildMemberStatusPeople(sourceProjectMembers, sourceWorkspaceMemberships);
  const sourceTasks = state.tasks.filter((task) =>
    task.status !== "split" &&
    task.status !== "archived" &&
    sourceProjectIds.has(task.projectId),
  );
  const sourceTaskIds = new Set(sourceTasks.map((task) => task.id));
  const todayTaskIdSet = new Set(
    state.dailyPlans
      .filter((plan) => plan.date === date)
      .flatMap((plan) => plan.committedTaskIds)
      .filter((taskId) => sourceTaskIds.has(taskId)),
  );
  const activeSessions = state.workSessions
    .filter((session) => session.status === "active" && sourceTasks.some((task) => task.id === session.taskId))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const projectNameById = new Map(state.projects.map((project) => [project.id, project.name]));
  const workspaceNameByProjectId = new Map(
    state.projects.flatMap((project): [string, string][] => {
      const workspaceName = workspaceForProject(state, project)?.name;
      return workspaceName ? [[project.id, workspaceName]] : [];
    }),
  );

  return members.map((member) => {
    const memberIdSet = new Set(member.memberIds);
    const runningSession = activeSessions.find((session) => session.executorMemberId && memberIdSet.has(session.executorMemberId));
    const runningTask = runningSession ? sourceTasks.find((task) => task.id === runningSession.taskId) : undefined;
    const memberTodayTasks = sourceTasks
      .filter((task) => (todayTaskIdSet.has(task.id) || task.id === runningTask?.id) && taskBelongsToMemberStatusPerson(task, member, memberIdSet))
      .sort((left, right) => {
        if (left.id === runningTask?.id) return -1;
        if (right.id === runningTask?.id) return 1;
        const statusDelta = stageTaskSortRank(left.status, false, true) - stageTaskSortRank(right.status, false, true);
        if (statusDelta !== 0) return statusDelta;
        return left.sortOrder - right.sortOrder;
      });
    const displayedTasks = runningTask && !memberTodayTasks.some((task) => task.id === runningTask.id)
      ? [runningTask, ...memberTodayTasks]
      : memberTodayTasks;
    const projectTaskGroups = groupMemberTasksByProject(member, displayedTasks, projectNameById, workspaceNameByProjectId)
      .filter((group) => group.tasks.length > 0);

    return {
      ...member,
      displayedTasks,
      projectTaskGroups,
      runningTask,
    };
  });
};

export function MemberStatusView({
  state,
  projectId,
  selectTask,
}: {
  state: AppState;
  projectId?: string;
  selectTask: (taskId: string | null) => void;
}) {
  const columns = buildMemberStatusColumns(state, projectId);
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state);
  const sourceProjectIds = projectId
    ? new Set(accessibleProjectIds.has(projectId) ? [projectId] : [])
    : accessibleProjectIds;
  const sourceTaskIds = new Set(state.tasks
    .filter((task) => task.status !== "split" && task.status !== "archived" && sourceProjectIds.has(task.projectId))
    .map((task) => task.id));
  const todayTaskCount = new Set(
    state.dailyPlans
      .filter((plan) => plan.date === today())
      .flatMap((plan) => plan.committedTaskIds)
      .filter((taskId) => sourceTaskIds.has(taskId)),
  ).size;

  return (
    <section className="band member-status-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">成员状况</p>
          <h2>今日任务总览</h2>
        </div>
        <span className="count-pill">{todayTaskCount}</span>
      </div>
      <div className="member-status-board" aria-label="成员今日任务列">
        {columns.map((member) => (
          <article className="member-status-column" key={member.id}>
            <div className="member-status-heading">
              <div>
                <strong>{member.name}</strong>
              </div>
              <span>{member.displayedTasks.length}</span>
            </div>
            <div className="member-task-list">
              {member.projectTaskGroups.map((group) => (
                <section
                  className={[
                    "member-project-task-group",
                    projectToneClassName(group.projectId),
                  ].filter(Boolean).join(" ")}
                  key={group.projectId}
                >
                  <div className="member-project-task-heading">
                    <div className="member-project-title">
                      <strong>{group.projectName}</strong>
                      {group.workspaceName && <span className="member-project-workspace">{group.workspaceName}</span>}
                      <span className="member-project-role">{group.roleLabel}</span>
                    </div>
                    <span className="member-project-count">{group.tasks.length}</span>
                  </div>
                  <div className="member-project-task-list">
                    {group.tasks.map((task) => {
                      const isRunning = task.id === member.runningTask?.id;
                      const statusIcon = task.status === "pending_review"
                        ? { label: "待验收", className: "review", icon: <ClipboardCheck aria-hidden="true" size={16} /> }
                        : task.status === "completed"
                          ? { label: "已完成", className: "completed", icon: <CheckCircle2 aria-hidden="true" size={16} /> }
                          : undefined;
                      return (
                        <button
                          className={[
                            "member-task-item",
                            isRunning ? "running" : "",
                            statusIcon ? `status-${statusIcon.className}` : "",
                          ].filter(Boolean).join(" ")}
                          key={task.id}
                          onClick={() => selectTask(task.id)}
                        >
                          <span className="member-task-copy">
                            <span className="member-task-title-row">
                              <strong>{task.title}</strong>
                              {isRunning && <span className="member-task-state">执行中</span>}
                            </span>
                            <span className="member-task-meta">{stageTaskStatusLabel(task.status)} · {labelTaskStage[task.stage]} · {task.progressPercent ?? 0}%</span>
                          </span>
                          {statusIcon && (
                            <span className={`member-task-status-icon ${statusIcon.className}`} title={statusIcon.label} aria-label={statusIcon.label}>
                              {statusIcon.icon}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
              {member.displayedTasks.length === 0 && <p className="empty">今日没有项目任务。</p>}
            </div>
          </article>
        ))}
        {columns.length === 0 && <p className="empty">暂无成员。</p>}
      </div>
    </section>
  );
}
