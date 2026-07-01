import { uid } from "./seed";
import { endActiveWorkSessionsForTaskInState } from "./workSessionTransitions";
import { compareProjectsForOverview } from "./projectOverview";
import type { AppState, Project, ProjectMember, ProjectMemberRole, Task, TeamMember } from "./types";

type IdFactory = (prefix: string) => string;

const cleanRoles = (roles: ProjectMemberRole[]): ProjectMemberRole[] =>
  roles.filter((role, index) => roles.indexOf(role) === index);

export const clampProgressPercent = (value?: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
};

const nextProjectSortOrder = (projects: Project[]) => {
  const orders = projects.map((project) => project.sortOrder).filter((value): value is number => Number.isFinite(value));
  if (orders.length) return Math.max(...orders) + 1000;
  return projects.length * 1000;
};

export function createProjectInState(
  state: AppState,
  name: string,
  description: string,
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
  owner?: { accountId?: string; name?: string; email?: string },
): AppState {
  const projectId = idFactory("project");
  const memberId = idFactory("member");
  const existingTeamMember = owner?.accountId
    ? state.teamMembers.find((member) => member.accountId === owner.accountId)
    : owner?.email
      ? state.teamMembers.find((member) => member.email?.toLowerCase() === owner.email?.toLowerCase())
      : undefined;
  const teamMemberId = existingTeamMember?.id ?? idFactory("team_member");
  const teamMember: TeamMember = existingTeamMember ?? {
    id: teamMemberId,
    accountId: owner?.accountId,
    name: owner?.name?.trim() || "项目负责人",
    email: owner?.email?.trim() || undefined,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    ...state,
    currentMemberId: memberId,
    projects: [
      {
        id: projectId,
        name: name.trim() || "新项目",
        description: description.trim(),
        defaultExpectedStartHours: 24,
        sortOrder: nextProjectSortOrder(state.projects),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projects,
    ],
    teamMembers: existingTeamMember ? state.teamMembers : [teamMember, ...state.teamMembers],
    projectMembers: [
      {
        id: memberId,
        projectId,
        teamMemberId,
        accountId: teamMember.accountId,
        name: teamMember.name,
        email: teamMember.email,
        roles: ["project_owner", "executor"],
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projectMembers,
    ],
    updatedAt: timestamp,
  };
}

export function createTeamMemberInState(
  state: AppState,
  name: string,
  email: string,
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
  accountId?: string,
): AppState {
  const normalizedEmail = email.trim();
  const existing = state.teamMembers.find(
    (member) =>
      (accountId && member.accountId === accountId) ||
      (normalizedEmail && member.email?.toLowerCase() === normalizedEmail.toLowerCase()),
  );
  if (existing) {
    return updateTeamMemberInState(state, {
      ...existing,
      accountId: existing.accountId ?? accountId,
      name: name.trim() || existing.name,
      email: normalizedEmail || existing.email,
      status: "active",
    }, timestamp);
  }
  return {
    ...state,
    teamMembers: [
      {
        id: idFactory("team_member"),
        accountId,
        name: name.trim() || "新成员",
        email: normalizedEmail || undefined,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.teamMembers,
    ],
    updatedAt: timestamp,
  };
}

export function updateTeamMemberInState(state: AppState, teamMember: TeamMember, timestamp = new Date().toISOString()): AppState {
  const updatedTeamMember = { ...teamMember, status: teamMember.status ?? "active", updatedAt: timestamp };
  return {
    ...state,
    teamMembers: state.teamMembers.map((item) => (item.id === teamMember.id ? updatedTeamMember : item)),
    projectMembers: state.projectMembers.map((member) =>
      member.teamMemberId === teamMember.id
        ? {
            ...member,
            accountId: updatedTeamMember.accountId ?? member.accountId,
            name: updatedTeamMember.name,
            email: updatedTeamMember.email,
            status: updatedTeamMember.status,
            updatedAt: timestamp,
          }
        : member,
    ),
    updatedAt: timestamp,
  };
}

export function deleteTeamMemberInState(state: AppState, teamMemberId: string, timestamp = new Date().toISOString()): AppState {
  const targetMember = state.teamMembers.find((member) => member.id === teamMemberId);
  const normalizedEmail = targetMember?.email?.trim().toLowerCase();
  const deletedTeamMemberIds = new Set<string>([teamMemberId]);
  const teamMemberAliases = state.sync.entityAliases?.filter((alias) => alias.entity === "team_member") ?? [];
  let changed = true;
  while (changed) {
    changed = false;
    teamMemberAliases.forEach((alias) => {
      if (deletedTeamMemberIds.has(alias.id) && !deletedTeamMemberIds.has(alias.canonicalId)) {
        deletedTeamMemberIds.add(alias.canonicalId);
        changed = true;
      }
      if (deletedTeamMemberIds.has(alias.canonicalId) && !deletedTeamMemberIds.has(alias.id)) {
        deletedTeamMemberIds.add(alias.id);
        changed = true;
      }
    });
  }
  state.teamMembers.forEach((member) => {
    if (targetMember?.accountId && member.accountId === targetMember.accountId) deletedTeamMemberIds.add(member.id);
    if (normalizedEmail && member.email?.trim().toLowerCase() === normalizedEmail) deletedTeamMemberIds.add(member.id);
  });
  const matchesDeletedIdentity = (member: { teamMemberId?: string; accountId?: string; email?: string }) =>
    Boolean(
      (member.teamMemberId && deletedTeamMemberIds.has(member.teamMemberId)) ||
      (targetMember?.accountId && member.accountId === targetMember.accountId) ||
      (normalizedEmail && member.email?.trim().toLowerCase() === normalizedEmail),
    );
  const deletedProjectMembers = state.projectMembers.filter(matchesDeletedIdentity);
  const deletedProjectMemberIds = new Set(deletedProjectMembers.map((member) => member.id));
  const projectMemberAliases = state.sync.entityAliases?.filter((alias) => alias.entity === "project_member") ?? [];
  changed = true;
  while (changed) {
    changed = false;
    projectMemberAliases.forEach((alias) => {
      if (deletedProjectMemberIds.has(alias.id) && !deletedProjectMemberIds.has(alias.canonicalId)) {
        deletedProjectMemberIds.add(alias.canonicalId);
        changed = true;
      }
      if (deletedProjectMemberIds.has(alias.canonicalId) && !deletedProjectMemberIds.has(alias.id)) {
        deletedProjectMemberIds.add(alias.id);
        changed = true;
      }
    });
  }
  const projectMembers = state.projectMembers.filter((member) => !deletedProjectMemberIds.has(member.id) && !matchesDeletedIdentity(member));
  return {
    ...state,
    teamMembers: state.teamMembers.filter((member) => !deletedTeamMemberIds.has(member.id)),
    projectMembers,
    currentMemberId: state.currentMemberId && deletedProjectMemberIds.has(state.currentMemberId) ? projectMembers[0]?.id : state.currentMemberId,
    tasks: state.tasks.map((task) => ({
      ...task,
      creatorMemberId: task.creatorMemberId && deletedProjectMemberIds.has(task.creatorMemberId) ? undefined : task.creatorMemberId,
      primaryExecutorMemberId: task.primaryExecutorMemberId && deletedProjectMemberIds.has(task.primaryExecutorMemberId)
        ? undefined
        : task.primaryExecutorMemberId,
      collaboratorMemberIds: task.collaboratorMemberIds?.filter((id) => !deletedProjectMemberIds.has(id)) ?? [],
      updatedAt:
        (task.creatorMemberId && deletedProjectMemberIds.has(task.creatorMemberId)) ||
        (task.primaryExecutorMemberId && deletedProjectMemberIds.has(task.primaryExecutorMemberId)) ||
        task.collaboratorMemberIds?.some((id) => deletedProjectMemberIds.has(id))
          ? timestamp
          : task.updatedAt,
    })),
    sync: {
      ...state.sync,
      tombstones: [
        ...(state.sync.tombstones ?? []).filter(
          (item) =>
            !(item.entity === "team_member" && deletedTeamMemberIds.has(item.id)) &&
            !(item.entity === "project_member" && deletedProjectMemberIds.has(item.id)),
        ),
        ...Array.from(deletedTeamMemberIds).map((id) => ({ entity: "team_member" as const, id, deletedAt: timestamp })),
        ...Array.from(deletedProjectMemberIds).map((id) => ({ entity: "project_member" as const, id, deletedAt: timestamp })),
      ],
      entityAliases: state.sync.entityAliases?.filter((alias) => {
        if (alias.entity === "team_member") return !deletedTeamMemberIds.has(alias.id) && !deletedTeamMemberIds.has(alias.canonicalId);
        return !deletedProjectMemberIds.has(alias.id) && !deletedProjectMemberIds.has(alias.canonicalId);
      }),
    },
    updatedAt: timestamp,
  };
}

export function updateProjectInState(state: AppState, project: Project, timestamp = new Date().toISOString()): AppState {
  return {
    ...state,
    projects: state.projects.map((item) => (item.id === project.id ? { ...project, updatedAt: timestamp } : item)),
    updatedAt: timestamp,
  };
}

export function reorderProjectsInState(state: AppState, orderedProjectIds: string[], timestamp = new Date().toISOString()): AppState {
  const knownProjectIds = new Set(state.projects.map((project) => project.id));
  const explicitOrder = orderedProjectIds.filter((projectId, index) =>
    knownProjectIds.has(projectId) && orderedProjectIds.indexOf(projectId) === index,
  );
  const orderedSet = new Set(explicitOrder);
  const completeOrder = [
    ...explicitOrder,
    ...[...state.projects]
      .sort(compareProjectsForOverview)
      .map((project) => project.id)
      .filter((projectId) => !orderedSet.has(projectId)),
  ];
  const sortOrderByProjectId = new Map(completeOrder.map((projectId, index) => [projectId, index * 1000]));
  let changed = false;
  const projects = state.projects.map((project) => {
    const sortOrder = sortOrderByProjectId.get(project.id);
    if (sortOrder === undefined || project.sortOrder === sortOrder) return project;
    changed = true;
    return { ...project, sortOrder, updatedAt: timestamp };
  });
  return changed ? { ...state, projects, updatedAt: timestamp } : state;
}

export function bindTeamMemberToProjectInState(
  state: AppState,
  projectId: string,
  teamMemberId: string,
  roles: ProjectMemberRole[],
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
): AppState {
  const teamMember = state.teamMembers.find((member) => member.id === teamMemberId);
  if (!teamMember) return state;
  const existing = state.projectMembers.find((member) => member.projectId === projectId && member.teamMemberId === teamMemberId);
  if (existing) {
    return updateProjectMemberInState(state, { ...existing, roles, status: "active" }, timestamp);
  }
  return {
    ...state,
    projectMembers: [
      {
        id: idFactory("member"),
        projectId,
        teamMemberId,
        accountId: teamMember.accountId,
        name: teamMember.name,
        email: teamMember.email,
        roles: cleanRoles(roles).length ? cleanRoles(roles) : ["executor"],
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projectMembers,
    ],
    updatedAt: timestamp,
  };
}

export function addProjectMemberToState(
  state: AppState,
  projectId: string,
  name: string,
  email: string,
  roles: ProjectMemberRole[],
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
): AppState {
  const withTeamMember = createTeamMemberInState(state, name, email, timestamp, idFactory);
  const created = withTeamMember.teamMembers.find(
    (member) => (email.trim() && member.email?.toLowerCase() === email.trim().toLowerCase()) || member.name === (name.trim() || "新成员"),
  ) ?? withTeamMember.teamMembers[0];
  return bindTeamMemberToProjectInState(withTeamMember, projectId, created.id, roles, timestamp, idFactory);
}

export function updateProjectMemberInState(state: AppState, member: ProjectMember, timestamp = new Date().toISOString()): AppState {
  const teamMember = member.teamMemberId ? state.teamMembers.find((item) => item.id === member.teamMemberId) : undefined;
  return {
    ...state,
    projectMembers: state.projectMembers.map((item) =>
      item.id === member.id
        ? {
            ...member,
            accountId: teamMember?.accountId ?? member.accountId,
            name: teamMember?.name ?? member.name,
            email: teamMember?.email ?? member.email,
            roles: cleanRoles(member.roles).length ? cleanRoles(member.roles) : ["executor"],
            status: member.status ?? "active",
            updatedAt: timestamp,
          }
        : item,
    ),
    updatedAt: timestamp,
  };
}

export function projectMembersForProject(state: AppState, projectId: string) {
  return state.projectMembers.filter((member) => member.projectId === projectId && member.status !== "disabled");
}

export function executorsForProject(state: AppState, projectId: string) {
  return projectMembersForProject(state, projectId).filter((member) => member.roles.includes("executor"));
}

export function assignTaskInState(
  state: AppState,
  taskId: string,
  assignment: {
    projectId?: string;
    primaryExecutorMemberId?: string;
    collaboratorMemberIds?: string[];
  },
  timestamp = new Date().toISOString(),
): AppState {
  const currentTask = state.tasks.find((task) => task.id === taskId);
  if (!currentTask) return state;

  const projectId = assignment.projectId ?? currentTask.projectId;
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  if (!project) return state;

  const projectMembers = projectMembersForProject(state, project.id);
  const executorIds = new Set(projectMembers.filter((member) => member.roles.includes("executor")).map((member) => member.id));
  const memberIds = new Set(projectMembers.map((member) => member.id));
  const primaryExecutorMemberId =
    assignment.primaryExecutorMemberId && executorIds.has(assignment.primaryExecutorMemberId)
      ? assignment.primaryExecutorMemberId
      : assignment.primaryExecutorMemberId === undefined
        ? currentTask.primaryExecutorMemberId && executorIds.has(currentTask.primaryExecutorMemberId)
          ? currentTask.primaryExecutorMemberId
          : undefined
        : undefined;
  const collaboratorMemberIds = Array.from(new Set(assignment.collaboratorMemberIds ?? currentTask.collaboratorMemberIds ?? []))
    .filter((memberId) => memberIds.has(memberId))
    .filter((memberId) => memberId !== primaryExecutorMemberId);

  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            projectId: project.id,
            project: project.name,
            primaryExecutorMemberId,
            collaboratorMemberIds,
            updatedAt: timestamp,
          }
        : task,
    ),
    updatedAt: timestamp,
  };
}

export function updateTaskProgressInState(
  state: AppState,
  taskId: string,
  progressPercent: number,
  progressNote: string,
  timestamp = new Date().toISOString(),
): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            progressPercent: clampProgressPercent(progressPercent),
            progressNote,
            updatedAt: timestamp,
          }
        : task,
    ),
    updatedAt: timestamp,
  };
}

const actualPomodorosForTask = (state: AppState, task: Task) =>
  state.focusSessions.filter((session) => session.taskId === task.id && session.outcome === "completed").length ||
  task.actualPomodoros ||
  0;

export function submitTaskForReviewInState(
  state: AppState,
  taskId: string,
  submitterMemberId: string | undefined,
  timestamp = new Date().toISOString(),
): AppState {
  const canSubmitForReview = (task: Task) => task.status === "committed" || task.status === "in_progress";
  const shouldEndActiveWork = state.tasks.some((task) => task.id === taskId && canSubmitForReview(task));
  const submitted = {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId && canSubmitForReview(task)
        ? {
            ...task,
            status: "pending_review" as const,
            progressPercent: 100,
            actualPomodoros: actualPomodorosForTask(state, task),
            reviewSubmittedAt: timestamp,
            reviewSubmittedByMemberId: submitterMemberId,
            reviewAcceptedAt: undefined,
            reviewAcceptedByMemberId: undefined,
            reviewReturnedAt: undefined,
            reviewReturnedByMemberId: undefined,
            reviewReturnReason: undefined,
            updatedAt: timestamp,
          }
        : task,
    ),
    updatedAt: timestamp,
  };
  if (!shouldEndActiveWork) return submitted;
  return endActiveWorkSessionsForTaskInState(submitted, taskId, timestamp, {
    reason: "submitted_for_review",
    activeTimerWorkSessionId: state.activeTimer?.workSessionId,
    activeTimerTotalPausedSeconds: state.activeTimer?.totalPausedSeconds,
    clearActiveTimer: true,
  });
}

export function acceptTaskInState(
  state: AppState,
  taskId: string,
  accepterMemberId: string | undefined,
  timestamp = new Date().toISOString(),
): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId || task.status !== "pending_review") return task;
      const actualPomodoros = actualPomodorosForTask(state, task);
      return {
        ...task,
        status: "completed" as const,
        progressPercent: 100,
        actualPomodoros,
        reviewAcceptedAt: timestamp,
        reviewAcceptedByMemberId: accepterMemberId,
        completedAt: timestamp,
        updatedAt: timestamp,
        estimateHistory: [
          ...(task.estimateHistory ?? []),
          {
            id: uid("estimate"),
            estimatedPomodoros: task.estimatePomodoros,
            actualPomodoros,
            recordedAt: timestamp,
            source: "completion" as const,
          },
        ],
      };
    }),
    updatedAt: timestamp,
  };
}

export function returnTaskForReviewInState(
  state: AppState,
  taskId: string,
  reason: string,
  reviewerMemberId: string | undefined,
  timestamp = new Date().toISOString(),
): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId && task.status === "pending_review"
        ? {
            ...task,
            status: "in_progress" as const,
            progressPercent: Math.min(task.progressPercent ?? 0, 99),
            reviewReturnedAt: timestamp,
            reviewReturnedByMemberId: reviewerMemberId,
            reviewReturnReason: reason.trim(),
            updatedAt: timestamp,
          }
        : task,
    ),
    updatedAt: timestamp,
  };
}
