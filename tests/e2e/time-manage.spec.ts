import { expect, test, type Page } from "@playwright/test";
import { createInitialState } from "../../src/seed";
import { flattenStateToChanges, type SyncRow } from "../../src/sync";
import type { AppState, ProjectInvitation } from "../../src/types";

const STORAGE_KEY = "timemanage.app_state.v1";
const MOCK_SERVER = "http://127.0.0.1:8787";

const authenticatedState = (): AppState => {
  const base = createInitialState();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const privateWorkspace = {
    id: "workspace_private_account_owner",
    name: "项目负责人私人区",
    type: "private" as const,
    ownerAccountId: "account_owner",
    createdAt: now,
    updatedAt: now,
  };
  const sharedWorkspace = {
    id: "workspace_e2e",
    name: "E2E 工作区",
    type: "shared" as const,
    ownerAccountId: "account_owner",
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...base,
    auth: {
      status: "authenticated",
      token: "e2e-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      bootstrapped: true,
      message: "E2E 本地登录",
      workspace: sharedWorkspace,
      workspaces: [privateWorkspace, sharedWorkspace],
      workspaceMemberships: [
        {
          id: "membership_workspace_private_account_owner",
          workspaceId: "workspace_private_account_owner",
          accountId: "account_owner",
          name: "项目负责人",
          email: "owner@example.com",
          role: "owner",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "membership_workspace_e2e_account_owner",
          workspaceId: "workspace_e2e",
          accountId: "account_owner",
          name: "项目负责人",
          email: "owner@example.com",
          role: "owner",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "membership_workspace_e2e_account_wangshuo",
          workspaceId: "workspace_e2e",
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          role: "member",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
      membership: {
        id: "membership_workspace_e2e_account_owner",
        workspaceId: "workspace_e2e",
        accountId: "account_owner",
        name: "项目负责人",
        email: "owner@example.com",
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      account: {
        id: "account_owner",
        workspaceId: "workspace_e2e",
        name: "项目负责人",
        email: "owner@example.com",
        createdAt: now,
        updatedAt: now,
      },
    },
    sync: {
      ...base.sync,
      enabled: false,
      token: "e2e-token",
      autoSync: false,
      serverUrl: MOCK_SERVER,
      status: "idle",
      message: "E2E 本地模式",
    },
    projects: base.projects.map((project) => ({ ...project, workspaceId: "workspace_e2e" })),
    projectMembers: base.projectMembers.map((member) => ({
      ...member,
      workspaceId: "workspace_e2e",
      accountId: "account_owner",
      email: "owner@example.com",
    })),
    onboarding: {
      ...base.onboarding,
      completed: true,
    },
    tasks: [
      {
        id: "task_e2e_prd",
        title: "整理时间管理系统 PRD",
        notes: "把方法论、竞品图和旧系统升级点沉淀成可执行范围。",
        tags: ["方法论", "产品"],
        projectId: "project_starter",
        project: "TimeManage",
        creatorMemberId: "member_owner",
        primaryExecutorMemberId: "member_owner",
        collaboratorMemberIds: [],
        progressPercent: 0,
        progressNote: "",
        priority: "urgent",
        severity: "high",
        stage: "requirements",
        estimatePomodoros: 3,
        status: "committed",
        repeatRule: "none",
        subtasks: [],
        sortOrder: 10,
        actualPomodoros: 0,
        estimateHistory: [],
        createdAt: now,
        updatedAt: now,
        workspaceId: "workspace_e2e",
      },
    ],
    dailyPlans: [
      {
        id: `plan_${today}`,
        date: today,
        capacityPomodoros: 8,
        committedTaskIds: ["task_e2e_prd"],
        completedPomodoros: 0,
        suggestedTaskIds: [],
        reflection: "",
        review: {
          mood: "normal",
          wins: "",
          blockers: "",
          interruptionPattern: "",
          tomorrowFocus: "",
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    updatedAt: now,
  };
};

const rowsFromState = (state: AppState, revision: number): SyncRow[] =>
  flattenStateToChanges(state).map((change) => ({
    ...change,
    revision,
    version: 1,
  }));

const upsertById = <T extends { id: string }>(items: T[], item: T) =>
  items.some((value) => value.id === item.id)
    ? items.map((value) => (value.id === item.id ? item : value))
    : [item, ...items];

const applyRemoteChange = (state: AppState, change: SyncRow): AppState => {
  if (change.deleted_at) return state;
  const payload = change.payload as never;
  if (change.entity === "settings") return { ...state, settings: payload };
  if (change.entity === "onboarding") return { ...state, onboarding: payload };
  if (change.entity === "reward_state") return { ...state, rewardState: payload };
  if (change.entity === "project") return { ...state, projects: upsertById(state.projects, payload) };
  if (change.entity === "project_member") return { ...state, projectMembers: upsertById(state.projectMembers, payload) };
  if (change.entity === "task") return { ...state, tasks: upsertById(state.tasks, payload) };
  if (change.entity === "daily_plan") return { ...state, dailyPlans: upsertById(state.dailyPlans, payload) };
  if (change.entity === "focus_session") return { ...state, focusSessions: upsertById(state.focusSessions, payload) };
  if (change.entity === "work_session") return { ...state, workSessions: upsertById(state.workSessions, payload) };
  if (change.entity === "execution_signal") return { ...state, executionSignals: upsertById(state.executionSignals, payload) };
  if (change.entity === "interruption") return { ...state, interruptions: upsertById(state.interruptions, payload) };
  if (change.entity === "strict_violation") return { ...state, strictViolations: upsertById(state.strictViolations, payload) };
  if (change.entity === "block_profile") return { ...state, blockProfiles: upsertById(state.blockProfiles, payload) };
  return state;
};

type MockProjectInvitation = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  project_id: string;
  project_name: string;
  inviter_account_id: string;
  inviter_name: string;
  inviter_email: string;
  invitee_account_id: string;
  invitee_email: string;
  roles: string[];
  status: ProjectInvitation["status"];
  created_at: string;
  updated_at: string;
  accepted_at?: string;
};

type MockTeamBackendOptions = {
  projectInvitations?: MockProjectInvitation[];
  acceptedProjectInvitationState?: AppState;
};

const mockTeamBackend = async (page: Page, initialState: AppState, options: MockTeamBackendOptions = {}) => {
  const projectInvitations: MockProjectInvitation[] = options.projectInvitations ? [...options.projectInvitations] : [];
  const workspaceInvitations: Array<{
    id: string;
    workspace_id: string;
    workspace_name: string;
    workspace_type: string;
    inviter_account_id: string;
    inviter_name: string;
    inviter_email: string;
    invitee_account_id: string;
    invitee_email: string;
    status: string;
    created_at: string;
    updated_at: string;
  }> = [];
  let mockWorkspaces = [...(initialState.auth.workspaces ?? [])];
  let mockMemberships = [...(initialState.auth.workspaceMemberships ?? [])];
  let projectInvitationAccepted = false;
  const privateWorkspace = initialState.auth.workspaces?.find((workspace) => workspace.type === "private");
  const workspaceStates: Record<string, AppState> = {
    [initialState.auth.workspace?.id ?? "workspace_e2e"]: initialState,
    ...(privateWorkspace
      ? {
          [privateWorkspace.id]: {
            ...initialState,
            auth: {
              ...initialState.auth,
              workspace: privateWorkspace,
            },
            projects: privateWorkspace.id === initialState.auth.workspace?.id ? initialState.projects : [],
            projectMembers: privateWorkspace.id === initialState.auth.workspace?.id ? initialState.projectMembers : [],
            tasks: privateWorkspace.id === initialState.auth.workspace?.id ? initialState.tasks : [],
            dailyPlans: privateWorkspace.id === initialState.auth.workspace?.id ? initialState.dailyPlans : [],
          },
        }
      : {}),
    workspace_private_account_owner: {
      ...initialState,
      auth: {
        ...initialState.auth,
        workspace: initialState.auth.workspaces?.find((workspace) => workspace.id === "workspace_private_account_owner"),
      },
      projects: [],
      projectMembers: [],
      tasks: [],
      dailyPlans: [],
    },
  };
  let activeWorkspaceId = initialState.auth.workspace?.id ?? "workspace_e2e";
  let revision = 1;
  await page.route(`${MOCK_SERVER}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          bootstrapped: true,
          workspace_id: initialState.auth.workspace?.id,
          workspace_name: initialState.auth.workspace?.name,
        }),
      });
      return;
    }
    if (url.pathname === "/auth/switch-workspace") {
      const body = request.postDataJSON() as { workspace_id?: string };
      const workspace = mockWorkspaces.find((item) => item.id === body.workspace_id);
      if (!workspace) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "workspace access denied" }),
        });
        return;
      }
      activeWorkspaceId = workspace.id;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "e2e-token",
          user_id: initialState.auth.account?.id,
          expires_at: initialState.auth.expiresAt,
          account: {
            id: initialState.auth.account?.id,
            workspace_id: workspace.id,
            name: initialState.auth.account?.name,
            email: initialState.auth.account?.email,
            created_at: initialState.auth.account?.createdAt,
            updated_at: initialState.auth.account?.updatedAt,
          },
          workspace: {
            id: workspace.id,
            name: workspace.name,
            type: workspace.type,
            owner_account_id: workspace.ownerAccountId,
            created_at: workspace.createdAt,
            updated_at: workspace.updatedAt,
          },
          membership: {
            id: `membership_${workspace.id}_account_owner`,
            workspace_id: workspace.id,
            account_id: initialState.auth.account?.id,
            name: initialState.auth.account?.name,
            email: initialState.auth.account?.email,
            role: "owner",
            status: "active",
            created_at: workspace.createdAt,
            updated_at: workspace.updatedAt,
          },
          workspaces: mockWorkspaces.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            owner_account_id: item.ownerAccountId,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
          })),
        }),
      });
      return;
    }
    if (url.pathname.startsWith("/project-invitations/") && url.pathname.endsWith("/accept")) {
      const invitationId = decodeURIComponent(url.pathname.replace("/project-invitations/", "").replace("/accept", ""));
      const invitationIndex = projectInvitations.findIndex((invitation) => invitation.id === invitationId);
      if (request.method() !== "POST" || invitationIndex < 0) {
        await route.fulfill({
          status: invitationIndex < 0 ? 404 : 405,
          contentType: "application/json",
          body: JSON.stringify({ error: invitationIndex < 0 ? "project invitation not found" : "method not allowed" }),
        });
        return;
      }
      const now = new Date().toISOString();
      const invitation = {
        ...projectInvitations[invitationIndex],
        status: "accepted" as const,
        updated_at: now,
        accepted_at: now,
      };
      projectInvitations[invitationIndex] = invitation;
      projectInvitationAccepted = true;
      activeWorkspaceId = invitation.workspace_id;
      if (options.acceptedProjectInvitationState) {
        workspaceStates[invitation.workspace_id] = options.acceptedProjectInvitationState;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ invitation }),
      });
      return;
    }
    if (url.pathname === "/workspaces") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspaces: mockWorkspaces.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            type: workspace.type,
            owner_account_id: workspace.ownerAccountId,
            created_at: workspace.createdAt,
            updated_at: workspace.updatedAt,
          })) ?? [],
          memberships: mockMemberships.map((membership) => ({
            id: membership.id,
            workspace_id: membership.workspaceId,
            account_id: membership.accountId,
            name: membership.name,
            email: membership.email,
            role: membership.role,
            status: membership.status,
            created_at: membership.createdAt,
            updated_at: membership.updatedAt,
          })) ?? [],
        }),
      });
      return;
    }
    if (url.pathname.startsWith("/workspaces/")) {
      const workspacePathParts = url.pathname.split("/").filter(Boolean);
      const workspaceId = decodeURIComponent(workspacePathParts[1] ?? "");
      if (workspacePathParts.length === 4 && workspacePathParts[2] === "members") {
        const membershipId = decodeURIComponent(workspacePathParts[3] ?? "");
        const membership = mockMemberships.find((item) => item.workspaceId === workspaceId && item.id === membershipId);
        if (request.method() !== "PATCH" || !membership) {
          await route.fulfill({
            status: membership ? 405 : 404,
            contentType: "application/json",
            body: JSON.stringify({ error: membership ? "method not allowed" : "workspace member not found" }),
          });
          return;
        }
        const body = request.postDataJSON() as { status?: "active" | "disabled" };
        const now = new Date().toISOString();
        const updatedMembership = {
          ...membership,
          status: body.status ?? membership.status,
          updatedAt: now,
        };
        mockMemberships = mockMemberships.map((item) => (item.id === membershipId ? updatedMembership : item));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            membership: {
              id: updatedMembership.id,
              workspace_id: updatedMembership.workspaceId,
              account_id: updatedMembership.accountId,
              name: updatedMembership.name,
              email: updatedMembership.email,
              role: updatedMembership.role,
              status: updatedMembership.status,
              created_at: updatedMembership.createdAt,
              updated_at: updatedMembership.updatedAt,
            },
          }),
        });
        return;
      }
      const workspace = mockWorkspaces.find((item) => item.id === workspaceId);
      if (request.method() !== "PATCH" || !workspace) {
        await route.fulfill({
          status: workspace ? 405 : 404,
          contentType: "application/json",
          body: JSON.stringify({ error: workspace ? "method not allowed" : "workspace not found" }),
        });
        return;
      }
      const body = request.postDataJSON() as { name?: string; type?: "private" | "shared"; owner_account_id?: string };
      const now = new Date().toISOString();
      const updatedWorkspace = {
        ...workspace,
        name: body.name?.trim() || workspace.name,
        type: body.type ?? workspace.type,
        ownerAccountId: body.owner_account_id || workspace.ownerAccountId,
        updatedAt: now,
      };
      mockWorkspaces = mockWorkspaces.map((item) => (item.id === workspaceId ? updatedWorkspace : item));
      if (body.owner_account_id) {
        mockMemberships = mockMemberships.map((membership) =>
          membership.workspaceId === workspaceId
            ? {
                ...membership,
                role: membership.accountId === body.owner_account_id ? "owner" : membership.role === "owner" ? "member" : membership.role,
                updatedAt: now,
              }
            : membership,
        );
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspace: {
            id: updatedWorkspace.id,
            name: updatedWorkspace.name,
            type: updatedWorkspace.type,
            owner_account_id: updatedWorkspace.ownerAccountId,
            created_at: updatedWorkspace.createdAt,
            updated_at: updatedWorkspace.updatedAt,
          },
        }),
      });
      return;
    }
    if (url.pathname === "/workspace-invitations") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as { workspace_id?: string; email?: string };
        const workspace = mockWorkspaces.find((item) => item.id === body.workspace_id);
        const now = new Date().toISOString();
        const invitation = {
          id: `workspace_invitation_${workspaceInvitations.length + 1}`,
          workspace_id: workspace?.id ?? body.workspace_id ?? "",
          workspace_name: workspace?.name ?? "未知工作区",
          workspace_type: workspace?.type ?? "shared",
          inviter_account_id: initialState.auth.account?.id ?? "account_owner",
          inviter_name: initialState.auth.account?.name ?? "项目负责人",
          inviter_email: initialState.auth.account?.email ?? "owner@example.com",
          invitee_account_id: `account_${body.email ?? "invitee"}`,
          invitee_email: body.email ?? "",
          status: "pending",
          created_at: now,
          updated_at: now,
        };
        workspaceInvitations.push(invitation);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ invitation }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ invitations: workspaceInvitations }),
      });
      return;
    }
    if (url.pathname === "/project-invitations") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as { workspace_id?: string; project_id?: string; email?: string; roles?: string[] };
        const serverState = workspaceStates[activeWorkspaceId] ?? initialState;
        const project = serverState.projects.find((item) => item.id === body.project_id);
        const workspace = mockWorkspaces.find((item) => item.id === (body.workspace_id ?? activeWorkspaceId));
        const now = new Date().toISOString();
        const invitation = {
          id: `project_invitation_${projectInvitations.length + 1}`,
          workspace_id: workspace?.id ?? body.workspace_id ?? activeWorkspaceId,
          workspace_name: workspace?.name ?? "E2E 工作区",
          project_id: body.project_id ?? "",
          project_name: project?.name ?? "未知项目",
          inviter_account_id: initialState.auth.account?.id ?? "account_owner",
          inviter_name: initialState.auth.account?.name ?? "项目负责人",
          inviter_email: initialState.auth.account?.email ?? "owner@example.com",
          invitee_account_id: `account_${body.email ?? "invitee"}`,
          invitee_email: body.email ?? "",
          roles: body.roles ?? ["executor"],
          status: "pending" as const,
          created_at: now,
          updated_at: now,
        };
        projectInvitations.push(invitation);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ invitation }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ invitations: projectInvitations }),
      });
      return;
    }
    if (url.pathname === "/team/state" || url.pathname === "/team/state/all") {
      const serverState = projectInvitationAccepted && options.acceptedProjectInvitationState
        ? options.acceptedProjectInvitationState
        : workspaceStates[activeWorkspaceId] ?? initialState;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ current_revision: revision, changes: rowsFromState(serverState, revision) }),
      });
      return;
    }
    if (url.pathname === "/team/revision" || url.pathname === "/sync/revision") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ current_revision: revision }),
      });
      return;
    }
    if (url.pathname === "/team/changes") {
      const body = request.postDataJSON() as { changes?: SyncRow[] };
      const accepted = (body.changes ?? []).map((change) => ({ ...change, revision: ++revision, version: 1 }));
      const serverState = workspaceStates[activeWorkspaceId] ?? initialState;
      workspaceStates[activeWorkspaceId] = accepted.reduce(applyRemoteChange, serverState);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted, conflicts: [], current_revision: revision }),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: `unhandled mock route: ${url.pathname}` }),
    });
  });
};

const openApp = async (page: Page, state = authenticatedState(), backendOptions: MockTeamBackendOptions = {}) => {
  await mockTeamBackend(page, state, backendOptions);
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: state },
  );
  await page.goto("/");
};

const projectInviteeScenario = () => {
  const ownerState = authenticatedState();
  const now = new Date().toISOString();
  const privateWorkspace = {
    id: "workspace_private_account_invitee",
    name: "受邀成员私人区",
    type: "private" as const,
    ownerAccountId: "account_invitee",
    createdAt: now,
    updatedAt: now,
  };
  const sharedWorkspace = ownerState.auth.workspaces?.find((workspace) => workspace.id === "workspace_e2e");
  if (!sharedWorkspace) throw new Error("missing shared workspace fixture");
  const hiddenProject = {
    ...ownerState.projects[0],
    id: "project_hidden_workspace_only",
    name: "E2E 工作区隐藏项目",
    description: "只有工作区成员可见，项目邀请成员不应看到。",
    sortOrder: 99,
    updatedAt: now,
  };
  const hiddenTask = {
    ...ownerState.tasks[0],
    id: "task_hidden_workspace_only",
    projectId: hiddenProject.id,
    project: hiddenProject.name,
    title: "E2E 隐藏项目任务",
    sortOrder: 99,
    updatedAt: now,
  };
  const initialState: AppState = {
    ...ownerState,
    auth: {
      ...ownerState.auth,
      account: {
        id: "account_invitee",
        workspaceId: privateWorkspace.id,
        name: "受邀成员",
        email: "invitee@example.com",
        createdAt: now,
        updatedAt: now,
      },
      workspace: privateWorkspace,
      workspaces: [privateWorkspace, sharedWorkspace],
      membership: {
        id: "membership_workspace_private_account_invitee",
        workspaceId: privateWorkspace.id,
        accountId: "account_invitee",
        name: "受邀成员",
        email: "invitee@example.com",
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      workspaceMemberships: [
        {
          id: "membership_workspace_private_account_invitee",
          workspaceId: privateWorkspace.id,
          accountId: "account_invitee",
          name: "受邀成员",
          email: "invitee@example.com",
          role: "owner",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    projects: [],
    projectMembers: [],
    tasks: [],
    dailyPlans: [],
    updatedAt: now,
  };
  const acceptedProjectMember = {
    id: "member_invitee_project_starter",
    workspaceId: sharedWorkspace.id,
    projectId: "project_starter",
    accountId: "account_invitee",
    name: "受邀成员",
    email: "invitee@example.com",
    roles: ["executor" as const],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };
  const acceptedState: AppState = {
    ...initialState,
    auth: {
      ...initialState.auth,
      workspace: sharedWorkspace,
      workspaces: [privateWorkspace, sharedWorkspace],
    },
    projects: ownerState.projects,
    projectMembers: [
      ...ownerState.projectMembers.map((member) => ({
        ...member,
        workspaceId: sharedWorkspace.id,
        accountId: "account_owner",
        email: "owner@example.com",
      })),
      acceptedProjectMember,
    ],
    tasks: ownerState.tasks,
    dailyPlans: ownerState.dailyPlans,
    updatedAt: now,
  };
  const fullWorkspaceState: AppState = {
    ...acceptedState,
    projects: [...acceptedState.projects, hiddenProject],
    tasks: [...acceptedState.tasks, hiddenTask],
    dailyPlans: acceptedState.dailyPlans.map((plan) => ({
      ...plan,
      committedTaskIds: [...plan.committedTaskIds, hiddenTask.id],
    })),
  };
  const invitation: MockProjectInvitation = {
    id: "project_invitation_invitee_starter",
    workspace_id: sharedWorkspace.id,
    workspace_name: sharedWorkspace.name,
    project_id: "project_starter",
    project_name: "TimeManage 团队进度",
    inviter_account_id: "account_owner",
    inviter_name: "项目负责人",
    inviter_email: "owner@example.com",
    invitee_account_id: "account_invitee",
    invitee_email: "invitee@example.com",
    roles: ["executor"],
    status: "pending",
    created_at: now,
    updated_at: now,
  };
  return { initialState, acceptedState, fullWorkspaceState, invitation };
};

const workspaceMemberState = () => {
  const state = authenticatedState();
  const sharedWorkspace = state.auth.workspaces?.find((workspace) => workspace.id === "workspace_e2e");
  const membership = state.auth.workspaceMemberships?.find((item) => item.accountId === "account_wangshuo");
  if (!sharedWorkspace || !membership) throw new Error("missing workspace member fixture");
  return {
    ...state,
    auth: {
      ...state.auth,
      account: {
        id: "account_wangshuo",
        workspaceId: sharedWorkspace.id,
        name: "王硕",
        email: "wangshuo",
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
      workspace: sharedWorkspace,
      membership,
    },
    sync: {
      ...state.sync,
      username: "wangshuo",
    },
  };
};

const projectMoveState = (): AppState => {
  const state = authenticatedState();
  const now = new Date().toISOString();
  const targetWorkspace = {
    id: "workspace_e2e_target",
    name: "E2E 目标工作区",
    type: "shared" as const,
    ownerAccountId: "account_owner",
    createdAt: now,
    updatedAt: now,
  };
  const targetMembership = {
    id: "membership_workspace_e2e_target_account_owner",
    workspaceId: targetWorkspace.id,
    accountId: "account_owner",
    name: "项目负责人",
    email: "owner@example.com",
    role: "owner" as const,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...state,
    auth: {
      ...state.auth,
      workspaces: [...(state.auth.workspaces ?? []), targetWorkspace],
      workspaceMemberships: [...(state.auth.workspaceMemberships ?? []), targetMembership],
    },
    projects: state.projects.map((project) =>
      project.id === "project_starter" ? { ...project, workspaceId: "workspace_e2e" } : project,
    ),
    projectMembers: state.projectMembers.map((member) =>
      member.projectId === "project_starter" ? { ...member, workspaceId: "workspace_e2e" } : member,
    ),
    tasks: state.tasks.map((task) =>
      task.projectId === "project_starter" ? { ...task, workspaceId: "workspace_e2e" } : task,
    ),
  };
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

test("opens current navigation and primary work surfaces", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await expect(nav.getByRole("button", { name: "项目总览" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "我的任务" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "管理中心" })).toBeVisible();
  await expect(page.getByLabel("项目卡片总览")).toContainText("TimeManage 团队进度");

  await nav.getByRole("button", { name: "我的任务" }).click();
  await expect(page.getByRole("heading", { name: "活动清单" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "工作队列" })).toBeVisible();

  await nav.getByRole("button", { name: "管理中心" }).click();
  await expect(page.getByRole("heading", { name: "成员库、偏好与系统能力" })).toBeVisible();

  await nav.getByRole("button", { name: "开始工作" }).click();
  await expect(page.getByRole("heading", { name: "当下清单" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();
});

test("opens workspace directory instead of switching a single active workspace", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await expect(nav.getByRole("button", { name: "成员状况" })).toBeVisible();
  await expect(page.locator(".topbar-actions").getByLabel("当前工作区")).toHaveCount(0);

  await nav.getByRole("button", { name: "工作区" }).click();
  await expect(page.getByRole("heading", { name: "我的工作区" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E 工作区" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "项目负责人私人区" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /项目/ })).toContainText("1");
  await expect(page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /成员/ })).toContainText("2");
});

test("keeps private workspace member management locked to the owner", async ({ page }) => {
  await openApp(page);

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "项目负责人私人区" }).getByRole("button", { name: /成员/ }).click();

  const dialog = page.getByRole("dialog", { name: "项目负责人私人区 成员管理" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("工作区属性")).toHaveValue("私人工作区");
  await expect(dialog.getByLabel("工作区属性")).toBeDisabled();
  await expect(dialog.getByLabel("工作区负责人")).toBeDisabled();
  await expect(dialog).toContainText("私人工作区只允许本人使用，不支持添加成员。");
  await expect(dialog.getByLabel("成员登录账号")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "发送邀请" })).toHaveCount(0);
});

test("edits shared workspace owner and sends workspace invitation", async ({ page }) => {
  await openApp(page);

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /成员/ }).click();

  const dialog = page.getByRole("dialog", { name: "E2E 工作区 成员管理" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("工作区属性")).toBeEnabled();
  await expect(dialog.getByLabel("工作区负责人")).toBeEnabled();
  const ownerRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "项目负责人" }) });
  const wangshuoRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "王硕" }) });
  await expect(ownerRow.getByLabel("负责人")).toBeChecked();
  await expect(ownerRow.getByLabel("执行者")).toBeChecked();
  await expect(wangshuoRow.getByLabel("负责人")).not.toBeChecked();
  await expect(wangshuoRow.getByLabel("执行者")).toBeChecked();
  await expect(wangshuoRow.getByLabel("执行者")).toBeDisabled();

  const updateRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/workspaces/workspace_e2e` && request.method() === "PATCH",
  );
  await wangshuoRow.getByLabel("负责人").check();
  expect((await updateRequest).postDataJSON()).toMatchObject({
    name: "E2E 工作区",
    type: "shared",
    owner_account_id: "account_wangshuo",
  });
  await expect(page.getByText("工作区已更新")).toBeVisible();

  await dialog.getByLabel("成员登录账号").fill(" NewMember@Example.COM ");
  const inviteRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/workspace-invitations` && request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "发送邀请" }).click();
  expect((await inviteRequest).postDataJSON()).toEqual({
    workspace_id: "workspace_e2e",
    email: "newmember@example.com",
  });
  await expect(page.getByText("已向 newmember@example.com 发送工作区邀请")).toBeVisible();
});

test("unbinds a shared workspace member from workspace member list", async ({ page }) => {
  await openApp(page);

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /成员/ }).click();

  const dialog = page.getByRole("dialog", { name: "E2E 工作区 成员管理" });
  const ownerRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "项目负责人" }) });
  const wangshuoRow = dialog.locator(".workspace-member-row").filter({ has: page.locator("strong", { hasText: "王硕" }) });
  await expect(ownerRow.getByRole("button", { name: "解除绑定" })).toBeDisabled();
  await expect(wangshuoRow.getByRole("button", { name: "解除绑定" })).toBeEnabled();

  const unbindRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/workspaces/workspace_e2e/members/membership_workspace_e2e_account_wangshuo` &&
    request.method() === "PATCH",
  );
  await wangshuoRow.getByRole("button", { name: "解除绑定" }).click();
  expect((await unbindRequest).postDataJSON()).toEqual({ status: "disabled" });

  await expect(page.getByText("工作区成员已解除绑定")).toBeVisible();
  await expect(dialog.locator(".member-section-title").filter({ hasText: "成员列表" })).toContainText("1 人");
  await expect(dialog.locator(".workspace-member-row").filter({ hasText: "王硕" })).toHaveCount(0);
});

test("workspace member can see shared workspace projects and project tasks", async ({ page }) => {
  await openApp(page, workspaceMemberState());

  await expect(page.getByText("账号：王硕")).toBeVisible();
  const projectOverview = page.getByLabel("项目卡片总览");
  await expect(projectOverview).toContainText("TimeManage 团队进度");
  await expect(projectOverview.locator("article").filter({ hasText: "TimeManage 团队进度" })).toContainText("协作 · E2E 工作区");

  await projectOverview.getByRole("button", { name: "进入项目" }).click();
  await expect(page.getByText("协作工作区 · E2E 工作区")).toBeVisible();
  await expect(page.locator(".project-overview-task-board")).toContainText("整理时间管理系统 PRD");

  await page.getByRole("button", { name: "任务", exact: true }).click();
  await expect(page.locator(".project-task-table")).toContainText("整理时间管理系统 PRD");

  await page.getByLabel("页面导航").getByRole("button", { name: "成员状况" }).click();
  const memberBoard = page.getByLabel("成员今日任务列");
  await expect(memberBoard).toContainText("项目负责人");
  await expect(memberBoard).toContainText("王硕");
  await expect(memberBoard).toContainText("整理时间管理系统 PRD");
});

test("creates a regular project from workspace modal and opens regular stages", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await nav.getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "E2E 工作区" }).getByRole("button", { name: /项目/ }).click();

  const dialog = page.getByRole("dialog", { name: "E2E 工作区 项目管理" });
  await expect(dialog).toBeVisible();
  const createForm = dialog.locator(".workspace-project-create");
  await createForm.getByRole("button", { name: "添加项目" }).click();
  await expect(createForm).toContainText("项目名称不能为空");
  await createForm.getByLabel("项目名称").fill("E2E 常规项目");
  await createForm.getByLabel("项目类型").selectOption("regular");
  await createForm.getByLabel("项目说明").fill("用来验证常规项目阶段。");
  await createForm.getByRole("button", { name: "添加项目" }).click();

  const newProjectCard = dialog.locator("article").filter({ hasText: "E2E 常规项目" });
  await expect(newProjectCard).toContainText("用来验证常规项目阶段。");
  await newProjectCard.getByRole("button", { name: /进入项目/ }).click();

  await expect(page.getByText("协作工作区 · E2E 工作区")).toBeVisible();
  await expect(page.getByRole("heading", { name: "任务阶段总览" })).toBeVisible();
  await expect(page.locator(".project-overview-task-board")).toContainText("规划");
  await expect(page.locator(".project-overview-task-board")).toContainText("执行");
  await expect(page.locator(".project-overview-task-board")).toContainText("检查");
  await expect(page.locator(".project-overview-task-board")).not.toContainText("销售");
});

test("creates a project from overview add card without navigating away", async ({ page }) => {
  await openApp(page);

  const projectOverview = page.getByLabel("项目卡片总览");
  await projectOverview.getByRole("button", { name: /新增项目/ }).click();

  const dialog = page.getByRole("dialog", { name: "新增项目" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "我的工作区" })).toHaveCount(0);

  await dialog.getByRole("button", { name: "添加项目" }).click();
  await expect(dialog).toContainText("项目名称不能为空");
  await dialog.getByLabel("项目名称").fill("E2E 总览弹窗项目");
  await dialog.getByLabel("所属工作区").selectOption("workspace_e2e");
  await dialog.getByLabel("项目类型").selectOption("regular");
  await dialog.getByLabel("项目说明").fill("从项目总览弹窗创建。");
  await dialog.getByRole("button", { name: "添加项目" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(projectOverview).toContainText("E2E 总览弹窗项目");
  await expect(page.getByRole("heading", { name: "我的工作区" })).toHaveCount(0);

  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const project = parsed.projects?.find((item: { name: string }) => item.name === "E2E 总览弹窗项目");
        return project
          ? { workspaceId: project.workspaceId, taskStageMode: project.taskStageMode, description: project.description }
          : null;
      }, STORAGE_KEY),
    )
    .toEqual({
      workspaceId: "workspace_e2e",
      taskStageMode: "regular",
      description: "从项目总览弹窗创建。",
    });
});

test("hides project member management for private workspace projects", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await nav.getByRole("button", { name: "工作区" }).click();
  await page.locator("article").filter({ hasText: "项目负责人私人区" }).getByRole("button", { name: /项目/ }).click();

  const dialog = page.getByRole("dialog", { name: "项目负责人私人区 项目管理" });
  await expect(dialog).toBeVisible();
  const createForm = dialog.locator(".workspace-project-create");
  await createForm.getByLabel("项目名称").fill("E2E 私人项目");
  await createForm.getByLabel("项目类型").selectOption("regular");
  await createForm.getByRole("button", { name: "添加项目" }).click();

  await dialog.getByLabel("关闭").click();
  await nav.getByRole("button", { name: "项目总览" }).click();
  const privateProjectCard = page.getByLabel("项目卡片总览").locator("article").filter({ hasText: "E2E 私人项目" });
  await expect(privateProjectCard.locator(".workspace-source-badge")).toHaveText("私人");
  await privateProjectCard.getByRole("button", { name: "进入项目" }).click();
  await expect(page.getByText("私人工作区 · 项目负责人私人区")).toBeVisible();
  await expect(page.getByRole("button", { name: "项目成员管理" })).toHaveCount(0);
});

test("opens a project and creates a task with the unified task form", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await expect(page.getByRole("heading", { name: "任务阶段总览" })).toBeVisible();

  await page.getByRole("button", { name: "添加任务" }).click();
  const dialog = page.getByRole("dialog", { name: "添加项目任务" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("标题")).toBeVisible();
  await expect(dialog.getByLabel("主执行人")).toBeVisible();
  await expect(dialog.getByLabel("估算时长（小时）")).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "任务阶段" })).toBeVisible();
  await expect(dialog.getByLabel("任务类型")).toHaveCount(0);

  await dialog.getByLabel("标题").fill("E2E 项目弹窗任务");
  await dialog.getByRole("radio", { name: "开发" }).click();
  await dialog.getByLabel("估算时长（小时）").fill("2");
  await dialog.getByRole("button", { name: "创建任务" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("E2E 项目弹窗任务").first()).toBeVisible();

  await expect
    .poll(async () => {
      return page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed.tasks?.find((task: { title: string }) => task.title === "E2E 项目弹窗任务") ?? null;
      }, STORAGE_KEY);
    })
    .toMatchObject({
      title: "E2E 项目弹窗任务",
      stage: "development",
      estimatePomodoros: 5,
    });
});

test("shows inherited workspace members in project member management", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "项目成员管理" }).click();

  const summary = page.locator(".project-member-summary-grid");
  await expect(summary.locator("article").filter({ hasText: "项目成员" })).toContainText("2");
  await expect(summary.locator("article").filter({ hasText: "执行者" })).toContainText("2");

  const memberList = page.locator(".project-binding-list");
  await expect(memberList.locator(".project-binding-row").filter({ has: page.locator("strong", { hasText: "项目负责人" }) })).toContainText("项目成员");
  const wangshuoRow = memberList.locator(".project-binding-row").filter({ has: page.locator("strong", { hasText: "王硕" }) });
  await expect(wangshuoRow).toContainText("工作区成员");
  await expect(wangshuoRow.getByLabel("执行者")).toBeChecked();
  await expect(wangshuoRow.getByLabel("项目负责人")).not.toBeChecked();

  await wangshuoRow.getByLabel("项目负责人").check();
  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const member = parsed.projectMembers?.find((item: { projectId: string; accountId?: string }) =>
          item.projectId === "project_starter" && item.accountId === "account_wangshuo",
        );
        return member ? { roles: member.roles, status: member.status } : null;
      }, STORAGE_KEY),
    )
    .toEqual({
      roles: expect.arrayContaining(["executor", "project_owner"]),
      status: "active",
    });
});

test("sends project member invitation from current project", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "项目成员管理" }).click();
  await page.getByRole("button", { name: "添加成员" }).click();

  const dialog = page.getByRole("dialog", { name: "邀请项目成员" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("项目成员不会加入工作区成员列表")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "发送邀请" })).toBeDisabled();

  await dialog.getByLabel("成员登录账号").fill(" Invitee@Example.COM ");
  await dialog.getByLabel("项目负责人").check();
  const invitationRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/project-invitations` && request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "发送邀请" }).click();

  const requestBody = (await invitationRequest).postDataJSON() as { workspace_id: string; project_id: string; email: string; roles: string[] };
  expect(requestBody).toEqual({
    workspace_id: "workspace_e2e",
    project_id: "project_starter",
    email: "invitee@example.com",
    roles: ["executor", "project_owner"],
  });
  await expect(page.getByText("已向 invitee@example.com 发送项目邀请")).toBeVisible();
  await expect(dialog.getByLabel("成员登录账号")).toHaveValue("");
});

test("accepts a project invitation without expanding access to every workspace project", async ({ page }) => {
  const { initialState, acceptedState, fullWorkspaceState, invitation } = projectInviteeScenario();
  expect(fullWorkspaceState.projects.map((project) => project.name)).toContain("E2E 工作区隐藏项目");

  await openApp(page, initialState, {
    projectInvitations: [invitation],
    acceptedProjectInvitationState: fullWorkspaceState,
  });

  const projectOverview = page.getByLabel("项目卡片总览");
  await expect(projectOverview).not.toContainText("TimeManage 团队进度");

  const pendingButton = page.getByRole("button", { name: /待处理/ });
  await expect(pendingButton).toContainText("1");
  await pendingButton.click();

  const dialog = page.getByRole("dialog", { name: "待处理" });
  await expect(dialog).toContainText("项目 · E2E 工作区");
  await expect(dialog).toContainText("TimeManage 团队进度");
  const acceptResponse = page.waitForResponse((response) =>
    response.url() === `${MOCK_SERVER}/project-invitations/project_invitation_invitee_starter/accept` &&
    response.request().method() === "POST" &&
    response.ok(),
  );
  await dialog.getByRole("button", { name: "同意加入" }).click();
  await acceptResponse;

  await expect(page.getByText("已加入项目 TimeManage 团队进度")).toBeVisible();
  await expect(projectOverview).toContainText("TimeManage 团队进度");
  await expect(projectOverview).not.toContainText("E2E 工作区隐藏项目");
  await expect(projectOverview).not.toContainText("E2E 隐藏项目任务");
  await expect(pendingButton).not.toContainText("1");

  await page.getByLabel("页面导航").getByRole("button", { name: "成员状况" }).click();
  const memberBoard = page.getByLabel("成员今日任务列");
  await expect(memberBoard).toContainText("整理时间管理系统 PRD");
  await expect(memberBoard).not.toContainText("E2E 工作区隐藏项目");
  await expect(memberBoard).not.toContainText("E2E 隐藏项目任务");

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  const sharedWorkspaceCard = page.locator("article").filter({ hasText: "E2E 工作区" });
  await expect(sharedWorkspaceCard.getByRole("button", { name: /项目/ })).toContainText("1");
  await expect(sharedWorkspaceCard.getByRole("button", { name: /成员/ })).toContainText("1");
  await sharedWorkspaceCard.getByRole("button", { name: /项目/ }).click();
  const workspaceProjectsDialog = page.getByRole("dialog", { name: "E2E 工作区 项目管理" });
  await expect(workspaceProjectsDialog).toContainText("TimeManage 团队进度");
  await expect(workspaceProjectsDialog).not.toContainText("E2E 工作区隐藏项目");
  await expect(workspaceProjectsDialog).not.toContainText("E2E 隐藏项目任务");
  await workspaceProjectsDialog.getByLabel("关闭").click();

  await page.getByLabel("页面导航").getByRole("button", { name: "项目总览" }).click();
  await projectOverview.getByRole("button", { name: "进入项目" }).click();
  await expect(page.getByText("协作工作区 · E2E 工作区")).toBeVisible();
  await expect(page.getByRole("heading", { name: "任务阶段总览" })).toBeVisible();
});

test("saves project settings only after clicking save", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "设置" }).click();

  const settingsPanel = page.locator(".project-settings-panel");
  await expect(settingsPanel.getByLabel("默认预计开始（小时）")).toHaveCount(0);

  await settingsPanel.getByLabel("项目名称").fill("E2E 保存后项目名");
  await settingsPanel.getByLabel("项目类型").selectOption("regular");
  await settingsPanel.getByLabel("项目说明").fill("设置页点击保存后才写入。");
  await page.waitForTimeout(350);

  await expect
    .poll(async () => {
      return page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const project = parsed.projects?.find((item: { id: string }) => item.id === "project_starter");
        return project ? { name: project.name, description: project.description, taskStageMode: project.taskStageMode } : null;
      }, STORAGE_KEY);
    })
    .toMatchObject({
      name: "TimeManage 团队进度",
      description: "从个人时间管理迁移而来的团队进度管控起始项目。",
      taskStageMode: "software",
    });

  await settingsPanel.getByRole("button", { name: "保存项目资料" }).click();

  await expect
    .poll(async () => {
      return page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const project = parsed.projects?.find((item: { id: string }) => item.id === "project_starter");
        return project ? { name: project.name, description: project.description, taskStageMode: project.taskStageMode } : null;
      }, STORAGE_KEY);
    })
    .toEqual({
      name: "E2E 保存后项目名",
      description: "设置页点击保存后才写入。",
      taskStageMode: "regular",
    });

  await page.getByRole("button", { name: "概览" }).click();
  await page.locator(".project-overview-task-board").getByRole("button", { name: "添加任务" }).click();
  const dialog = page.getByRole("dialog", { name: "添加项目任务" });
  await expect(dialog.getByRole("radio", { name: "规划" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "执行" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "检查" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "开发" })).toHaveCount(0);
});

test("moves a project to another shared workspace from project settings", async ({ page }) => {
  await openApp(page, projectMoveState());

  await page.getByRole("button", { name: "进入项目" }).first().click();
  await page.getByRole("button", { name: "设置" }).click();

  const settingsPanel = page.locator(".project-settings-panel");
  await expect(settingsPanel.getByLabel("所属工作区")).toBeEnabled();
  await settingsPanel.getByLabel("所属工作区").selectOption("workspace_e2e_target");
  const saveRequest = page.waitForRequest((request) =>
    request.url() === `${MOCK_SERVER}/team/changes` && request.method() === "POST",
  );
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("E2E 目标工作区");
    await dialog.accept();
  });
  await settingsPanel.getByRole("button", { name: "保存项目资料" }).click();
  const requestBody = (await saveRequest).postDataJSON() as { changes: SyncRow[] };
  expect(requestBody.changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        workspace_id: "workspace_e2e_target",
        entity: "project",
        id: "project_starter",
      }),
      expect.objectContaining({
        workspace_id: "workspace_e2e",
        entity: "project",
        id: "project_starter",
        deleted_at: expect.any(String),
      }),
    ]),
  );

  await expect(page.getByText("协作工作区 · E2E 目标工作区")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const project = parsed.projects?.find((item: { id: string }) => item.id === "project_starter");
        const task = parsed.tasks?.find((item: { id: string }) => item.id === "task_e2e_prd");
        const member = parsed.projectMembers?.find((item: { id: string }) => item.id === "member_owner");
        return {
          projectWorkspaceId: project?.workspaceId,
          taskWorkspaceId: task?.workspaceId,
          memberWorkspaceId: member?.workspaceId,
        };
      }, STORAGE_KEY),
    )
    .toEqual({
      projectWorkspaceId: "workspace_e2e_target",
      taskWorkspaceId: "workspace_e2e_target",
      memberWorkspaceId: "workspace_e2e_target",
    });

  await page.getByLabel("页面导航").getByRole("button", { name: "工作区" }).click();
  const sourceWorkspaceCard = page.locator("article").filter({ hasText: "E2E 工作区" });
  const targetWorkspaceCard = page.locator("article").filter({ hasText: "E2E 目标工作区" });
  await expect(sourceWorkspaceCard.getByRole("button", { name: /项目/ })).toContainText("0");
  await expect(targetWorkspaceCard.getByRole("button", { name: /项目/ })).toContainText("1");

  await targetWorkspaceCard.getByRole("button", { name: /项目/ }).click();
  const targetDialog = page.getByRole("dialog", { name: "E2E 目标工作区 项目管理" });
  await expect(targetDialog).toContainText("TimeManage 团队进度");
});

test("edits task detail and persists progress fields", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "我的任务" }).click();
  await page.locator("article").filter({ hasText: "整理时间管理系统 PRD" }).getByTitle("任务详情").click();

  const dialog = page.getByRole("dialog", { name: /任务详情：整理时间管理系统 PRD/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("spinbutton", { name: "进度百分比" }).fill("45");
  await dialog.getByLabel("进展说明").fill("E2E 进度已持久化。");

  await expect
    .poll(async () => {
      return page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const task = parsed.tasks?.find((item: { title: string }) => item.title === "整理时间管理系统 PRD");
        return task ? { progressPercent: task.progressPercent, progressNote: task.progressNote } : null;
      }, STORAGE_KEY);
    })
    .toEqual({ progressPercent: 45, progressNote: "E2E 进度已持久化。" });

  await expect(dialog.getByRole("spinbutton", { name: "进度百分比" })).toHaveValue("45");
  await expect(dialog.getByLabel("进展说明")).toHaveValue("E2E 进度已持久化。");
});

test("opens calendar, daily review, reports and command palette", async ({ page }) => {
  await openApp(page);

  const nav = page.getByLabel("页面导航");
  await nav.getByRole("button", { name: "历史日报" }).click();
  await expect(page.getByRole("heading", { name: "历史日报" })).toBeVisible();

  await nav.getByRole("button", { name: "每日总结" }).click();
  await expect(page.getByRole("heading", { name: "日终回顾" })).toBeVisible();

  await nav.getByRole("button", { name: "复盘洞察" }).click();
  await expect(page.getByRole("heading", { name: "近 30 天复盘" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "自律激励" })).toBeVisible();

  await page.keyboard.press("/");
  await expect(page.getByRole("dialog", { name: "命令面板" })).toBeVisible();
});
