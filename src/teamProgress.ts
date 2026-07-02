import { uid } from "./seed";
import { endActiveWorkSessionsForTaskInState } from "./workSessionTransitions";
import { compareProjectsForOverview } from "./projectOverview";
import type { AppState, Project, ProjectMember, ProjectMemberRole, Task, TaskStageMode } from "./types";

type IdFactory = (prefix: string) => string;

const cleanRoles = (roles: ProjectMemberRole[]): ProjectMemberRole[] =>
  roles.filter((role, index) => roles.indexOf(role) === index);

const normalizedEmail = (email?: string) => email?.trim().toLowerCase();

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
  owner?: { accountId?: string; name?: string; email?: string; workspaceId?: string; taskStageMode?: TaskStageMode },
): AppState {
  const projectId = idFactory("project");
  const memberId = idFactory("member");
  const workspaceId = owner?.workspaceId ?? state.auth.workspace?.id ?? state.projects[0]?.workspaceId;
  const ownerName = owner?.name?.trim() || state.auth.account?.name || "项目负责人";
  const ownerEmail = owner?.email?.trim() || state.auth.account?.email;
  return {
    ...state,
    projects: [
      {
        id: projectId,
        workspaceId,
        name: name.trim() || "新项目",
        description: description.trim(),
        defaultExpectedStartHours: 24,
        taskStageMode: owner?.taskStageMode ?? "regular",
        sortOrder: nextProjectSortOrder(state.projects),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.projects,
    ],
    projectMembers: [
      {
        id: memberId,
        workspaceId,
        projectId,
        accountId: owner?.accountId ?? state.auth.account?.id,
        name: ownerName,
        email: ownerEmail,
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

export function updateProjectInState(state: AppState, project: Project, timestamp = new Date().toISOString(), _idFactory: IdFactory = uid): AppState {
  const existingProject = state.projects.find((item) => item.id === project.id);
  const previousWorkspaceId = existingProject?.workspaceId ?? state.auth.workspace?.id;
  const nextWorkspaceId = project.workspaceId;
  const workspaceChanged = Boolean(existingProject && previousWorkspaceId !== nextWorkspaceId);
  const projectTaskIds = new Set(state.tasks.filter((task) => task.projectId === project.id).map((task) => task.id));
  const movedProjectMemberIds = state.projectMembers.filter((member) => member.projectId === project.id).map((member) => member.id);
  const movedWorkSessionIds = state.workSessions.filter((session) => projectTaskIds.has(session.taskId)).map((session) => session.id);
  const movedExecutionSignalIds = state.executionSignals.filter((signal) => projectTaskIds.has(signal.taskId)).map((signal) => signal.id);
  const movedFocusSessionIds = state.focusSessions.filter((session) => session.taskId && projectTaskIds.has(session.taskId)).map((session) => session.id);
  const movedInterruptionIds = state.interruptions.filter((interruption) => interruption.taskId && projectTaskIds.has(interruption.taskId)).map((interruption) => interruption.id);
  const movedStrictViolationIds = state.strictViolations.filter((violation) => violation.taskId && projectTaskIds.has(violation.taskId)).map((violation) => violation.id);
  const movedEntityTombstones = workspaceChanged && previousWorkspaceId
    ? [
        { entity: "project" as const, id: project.id, workspaceId: previousWorkspaceId, deletedAt: timestamp },
        ...Array.from(projectTaskIds).map((id) => ({ entity: "task" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedProjectMemberIds.map((id) => ({ entity: "project_member" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedWorkSessionIds.map((id) => ({ entity: "work_session" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedExecutionSignalIds.map((id) => ({ entity: "execution_signal" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedFocusSessionIds.map((id) => ({ entity: "focus_session" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedInterruptionIds.map((id) => ({ entity: "interruption" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
        ...movedStrictViolationIds.map((id) => ({ entity: "strict_violation" as const, id, workspaceId: previousWorkspaceId, deletedAt: timestamp })),
      ]
    : [];
  return {
    ...state,
    projects: state.projects.map((item) => (item.id === project.id ? { ...project, updatedAt: timestamp } : item)),
    projectMembers: state.projectMembers.map((member) =>
      workspaceChanged && member.projectId === project.id
        ? {
            ...member,
            workspaceId: nextWorkspaceId,
            accountId: member.accountId,
            name: member.name,
            email: member.email,
            status: member.status ?? "active",
            updatedAt: timestamp,
          }
        : member,
    ),
    tasks: state.tasks.map((task) =>
      task.projectId === project.id
        ? {
            ...task,
            workspaceId: nextWorkspaceId,
            project: project.name,
            updatedAt:
              workspaceChanged || task.project !== project.name
                ? timestamp
                : task.updatedAt,
        }
        : task,
    ),
    workSessions: state.workSessions.map((session) =>
      workspaceChanged && projectTaskIds.has(session.taskId)
        ? { ...session, workspaceId: nextWorkspaceId, updatedAt: timestamp }
        : session,
    ),
    executionSignals: state.executionSignals.map((signal) =>
      workspaceChanged && projectTaskIds.has(signal.taskId)
        ? { ...signal, workspaceId: nextWorkspaceId }
        : signal,
    ),
    focusSessions: state.focusSessions.map((session) =>
      workspaceChanged && session.taskId && projectTaskIds.has(session.taskId)
        ? { ...session, workspaceId: nextWorkspaceId }
        : session,
    ),
    interruptions: state.interruptions.map((interruption) =>
      workspaceChanged && interruption.taskId && projectTaskIds.has(interruption.taskId)
        ? { ...interruption, workspaceId: nextWorkspaceId }
        : interruption,
    ),
    strictViolations: state.strictViolations.map((violation) =>
      workspaceChanged && violation.taskId && projectTaskIds.has(violation.taskId)
        ? { ...violation, workspaceId: nextWorkspaceId }
        : violation,
    ),
    sync: {
      ...state.sync,
      tombstones: [
        ...(state.sync.tombstones ?? []),
        ...movedEntityTombstones,
      ],
    },
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

export function addProjectMemberToState(
  state: AppState,
  projectId: string,
  name: string,
  email: string,
  roles: ProjectMemberRole[],
  timestamp = new Date().toISOString(),
  idFactory: IdFactory = uid,
  identity: { accountId?: string; workspaceId?: string } = {},
): AppState {
  const project = state.projects.find((item) => item.id === projectId);
  const workspaceId = project?.workspaceId ?? identity.workspaceId ?? state.auth.workspace?.id;
  const normalizedName = name.trim() || "新成员";
  const normalizedMemberEmail = email.trim() || undefined;
  const existing = state.projectMembers.find(
    (member) =>
      member.projectId === projectId &&
      member.status !== "disabled" &&
      (
        (identity.accountId && member.accountId === identity.accountId) ||
        (normalizedMemberEmail && normalizedEmail(member.email) === normalizedEmail(normalizedMemberEmail)) ||
        member.name === normalizedName
      ),
  );
  if (existing) {
    return updateProjectMemberInState(state, {
      ...existing,
      name: normalizedName,
      email: normalizedMemberEmail ?? existing.email,
      roles,
      status: "active",
    }, timestamp);
  }
  return {
    ...state,
    projectMembers: [
      {
        id: idFactory("member"),
        workspaceId,
        projectId,
        accountId: identity.accountId,
        name: normalizedName,
        email: normalizedMemberEmail,
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

export function updateProjectMemberInState(state: AppState, member: ProjectMember, timestamp = new Date().toISOString()): AppState {
  return {
    ...state,
    projectMembers: state.projectMembers.map((item) =>
      item.id === member.id
        ? {
            ...member,
            accountId: member.accountId,
            name: member.name,
            email: member.email,
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
            workspaceId: project.workspaceId ?? task.workspaceId,
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
