import { Building2, ChevronRight, Plus, Save, UserMinus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { taskStageModeOptions } from "../appModel";
import {
  countActiveWorkspaceMembers as countActiveWorkspaceMembersFromAccess,
  visibleWorkspaceMembers,
} from "../accessControl";
import type { ProjectOverviewCard } from "../projectOverview";
import type {
  Account,
  Project,
  TaskStageMode,
  Workspace,
  WorkspaceMembership,
  WorkspaceType,
  WorkspaceUpdateInput,
} from "../types";

type WorkspaceDirectoryCard = {
  workspace: Workspace;
  projects: ProjectOverviewCard[];
  taskCount: number;
  memberCount: number;
  pendingReviewCount: number;
  riskCount: number;
  progressPercent: number;
};

type WorkspaceModalState = {
  workspaceId: string;
  kind: "projects" | "members";
};

type ProjectEditDraft = Pick<Project, "name" | "description" | "taskStageMode">;

const workspaceTypeLabel = (workspace: Workspace) => (workspace.type ?? "shared") === "private" ? "私人工作区" : "协作工作区";

export const workspaceTypeForEditSave = (currentType: WorkspaceType, draftType?: WorkspaceType): WorkspaceType =>
  currentType === "private" ? "private" : draftType ?? currentType;

const inferWorkspaceOwnerAccountId = (workspace: Workspace, members: WorkspaceMembership[], fallbackAccountId?: string) =>
  workspace.ownerAccountId ||
  members.find((member) => member.role === "owner" && member.status === "active")?.accountId ||
  members.find((member) => member.role === "owner")?.accountId ||
  fallbackAccountId ||
  "";

export const countActiveWorkspaceMembers = countActiveWorkspaceMembersFromAccess;

const workspaceSortRank = (workspace: Workspace) => {
  const typeRank = (workspace.type ?? "shared") === "private" ? 0 : 1;
  const createdAt = new Date(workspace.createdAt).getTime();
  return typeRank * 1_000_000_000_000 + (Number.isFinite(createdAt) ? createdAt : 0);
};

export function WorkspaceDirectoryView({
  projects,
  workspaces,
  workspaceMemberships,
  currentAccount,
  projectCards,
  createWorkspace,
  updateWorkspace,
  updateWorkspaceMembership,
  inviteWorkspaceMember,
  createProject,
  updateProject,
  openProjectDetail,
}: {
  projects: Project[];
  workspaces: Workspace[];
  workspaceMemberships: WorkspaceMembership[];
  currentAccount?: Account;
  projectCards: ProjectOverviewCard[];
  createWorkspace: (name: string) => void;
  updateWorkspace: (workspaceId: string, input: WorkspaceUpdateInput) => Promise<boolean>;
  updateWorkspaceMembership: (workspaceId: string, membershipId: string, input: { status: WorkspaceMembership["status"] }) => Promise<boolean>;
  inviteWorkspaceMember: (workspaceId: string, email: string) => void;
  createProject: (name: string, description: string, workspaceId?: string, taskStageMode?: TaskStageMode) => void;
  updateProject: (project: Project) => void;
  openProjectDetail: (projectId: string) => void;
}) {
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState<{ name: string; description: string; taskStageMode: TaskStageMode }>({
    name: "",
    description: "",
    taskStageMode: "regular",
  });
  const [projectDraftWarning, setProjectDraftWarning] = useState("");
  const [activeModal, setActiveModal] = useState<WorkspaceModalState | null>(null);
  const [workspaceEditDraft, setWorkspaceEditDraft] = useState<WorkspaceUpdateInput>({ name: "", type: "shared", ownerAccountId: "" });
  const [workspaceEditWarning, setWorkspaceEditWarning] = useState<{ name?: string; owner?: string }>({});
  const [workspaceMemberDrafts, setWorkspaceMemberDrafts] = useState<Record<string, { email: string }>>({});
  const [projectEditDrafts, setProjectEditDrafts] = useState<Record<string, ProjectEditDraft>>({});
  const [projectEditWarnings, setProjectEditWarnings] = useState<Record<string, string>>({});

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const directoryCards = useMemo<WorkspaceDirectoryCard[]>(() => {
    return [...workspaces].sort((left, right) => workspaceSortRank(left) - workspaceSortRank(right) || left.id.localeCompare(right.id)).map((workspace) => {
      const cardProjects = projectCards.filter((project) => project.workspaceId === workspace.id);
      const taskCount = cardProjects.reduce((sum, project) => sum + project.taskCount, 0);
      const memberCount = countActiveWorkspaceMembers(workspace, workspaceMemberships, currentAccount);
      const pendingReviewCount = cardProjects.reduce((sum, project) => sum + project.pendingReviewCount, 0);
      const riskCount = cardProjects.reduce((sum, project) => sum + project.riskCount, 0);
      const progressPercent = cardProjects.length
        ? Math.round(cardProjects.reduce((sum, project) => sum + project.progressPercent, 0) / cardProjects.length)
        : 0;
      return { workspace, projects: cardProjects, taskCount, memberCount, pendingReviewCount, riskCount, progressPercent };
    });
  }, [workspaces, workspaceMemberships, currentAccount, projectCards]);

  const selectedCard = directoryCards.find((card) => card.workspace.id === activeModal?.workspaceId);
  const selectedAllMembers = selectedCard
    ? visibleWorkspaceMembers(selectedCard.workspace, workspaceMemberships, currentAccount)
    : [];
  const selectedMembers = selectedAllMembers.filter((member) => member.status === "active");
  const selectedWorkspaceType = selectedCard?.workspace.type ?? "shared";
  const selectedCurrentMembership = selectedAllMembers.find((membership) => membership.accountId === currentAccount?.id);
  const selectedCurrentMembershipIsActive = selectedCurrentMembership?.status === "active";
  const canEditSelectedWorkspace = Boolean(
    selectedCurrentMembershipIsActive && (selectedCurrentMembership?.role === "owner" || selectedCurrentMembership?.role === "admin"),
  );
  const canChangeSelectedWorkspaceType = Boolean(
    selectedCurrentMembershipIsActive && selectedCurrentMembership?.role === "owner" && selectedWorkspaceType !== "private",
  );
  const canChangeSelectedWorkspaceOwner = Boolean(
    selectedCurrentMembershipIsActive && selectedCurrentMembership?.role === "owner" && selectedWorkspaceType === "shared",
  );
  const selectedActiveMembers = selectedMembers;
  const selectedOwnerAccountId = selectedCard
    ? inferWorkspaceOwnerAccountId(selectedCard.workspace, selectedAllMembers, currentAccount?.id)
    : "";
  const editingOwnerAccountId = workspaceEditDraft.ownerAccountId || selectedOwnerAccountId;
  const selectedMemberDraft = selectedCard ? workspaceMemberDrafts[selectedCard.workspace.id] ?? { email: "" } : { email: "" };

  const openWorkspaceModal = (workspaceId: string, kind: WorkspaceModalState["kind"]) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    const members = workspaceMemberships.filter((membership) => membership.workspaceId === workspaceId);
    setActiveModal({ workspaceId, kind });
    setProjectDraftWarning("");
    setWorkspaceEditWarning({});
    if (workspace) {
      setWorkspaceEditDraft({
        name: workspace.name,
        type: workspace.type ?? "shared",
        ownerAccountId: inferWorkspaceOwnerAccountId(workspace, members, currentAccount?.id),
      });
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setProjectDraftWarning("");
    setWorkspaceEditWarning({});
    setWorkspaceEditDraft({ name: "", type: "shared", ownerAccountId: "" });
    setProjectEditDrafts({});
    setProjectEditWarnings({});
  };

  const submitWorkspace = () => {
    const name = workspaceDraft.trim();
    if (!name) return;
    createWorkspace(name);
    setWorkspaceDraft("");
  };

  const submitProject = () => {
    if (!selectedCard) return;
    const name = projectDraft.name.trim();
    if (!name) {
      setProjectDraftWarning("项目名称不能为空");
      return;
    }
    createProject(name, projectDraft.description, selectedCard.workspace.id, projectDraft.taskStageMode);
    setProjectDraft({ name: "", description: "", taskStageMode: "regular" });
    setProjectDraftWarning("");
  };

  const startWorkspaceEdit = () => {
    if (!selectedCard) return;
    setWorkspaceEditDraft({
      name: selectedCard.workspace.name,
      type: selectedCard.workspace.type ?? "shared",
      ownerAccountId: inferWorkspaceOwnerAccountId(selectedCard.workspace, selectedMembers, currentAccount?.id),
    });
    setWorkspaceEditWarning({});
  };

  const saveWorkspaceEdit = async () => {
    if (!selectedCard) return;
    const name = workspaceEditDraft.name.trim();
    if (!name) {
      setWorkspaceEditWarning({ name: "工作区名称不能为空" });
      return;
    }
    const ownerAccountId = workspaceEditDraft.ownerAccountId?.trim() || selectedOwnerAccountId;
    if (!ownerAccountId) {
      setWorkspaceEditWarning({ owner: "请选择工作区负责人" });
      return;
    }
    const saved = await updateWorkspace(selectedCard.workspace.id, {
      name,
      type: workspaceTypeForEditSave(selectedWorkspaceType, workspaceEditDraft.type),
      ownerAccountId,
    });
    if (saved) setWorkspaceEditWarning({});
  };

  const selectWorkspaceOwner = async (accountId: string, checked: boolean) => {
    if (!selectedCard || !checked || accountId === selectedOwnerAccountId || !canChangeSelectedWorkspaceOwner) return;
    setWorkspaceEditDraft({
      ...workspaceEditDraft,
      name: workspaceEditDraft.name || selectedCard.workspace.name,
      type: workspaceEditDraft.type || selectedWorkspaceType,
      ownerAccountId: accountId,
    });
    await updateWorkspace(selectedCard.workspace.id, {
      name: workspaceEditDraft.name || selectedCard.workspace.name,
      type: workspaceTypeForEditSave(selectedWorkspaceType, workspaceEditDraft.type),
      ownerAccountId: accountId,
    });
  };

  const unbindWorkspaceMember = async (member: WorkspaceMembership) => {
    if (!selectedCard || !canEditSelectedWorkspace || selectedWorkspaceType === "private") return;
    const isOwner = member.accountId === selectedOwnerAccountId || member.role === "owner";
    const isCurrentAccount = member.accountId === currentAccount?.id;
    if (isOwner || isCurrentAccount) return;
    await updateWorkspaceMembership(selectedCard.workspace.id, member.id, { status: "disabled" });
  };

  const updateWorkspaceMemberDraft = (workspaceId: string, patch: Partial<{ email: string }>) => {
    setWorkspaceMemberDrafts((current) => {
      const previous = current[workspaceId] ?? { email: "" };
      return {
        ...current,
        [workspaceId]: { ...previous, ...patch },
      };
    });
  };

  const projectEditDraftFor = (project: Project): ProjectEditDraft => (
    projectEditDrafts[project.id] ?? {
      name: project.name,
      description: project.description,
      taskStageMode: project.taskStageMode ?? "software",
    }
  );

  const updateProjectEditDraft = (project: Project, patch: Partial<ProjectEditDraft>) => {
    setProjectEditDrafts((current) => ({
      ...current,
      [project.id]: { ...projectEditDraftFor(project), ...patch },
    }));
    if (projectEditWarnings[project.id]) {
      setProjectEditWarnings((current) => ({ ...current, [project.id]: "" }));
    }
  };

  const saveProjectEdit = (project: Project) => {
    const draft = projectEditDraftFor(project);
    const name = draft.name.trim();
    if (!name) {
      setProjectEditWarnings((current) => ({ ...current, [project.id]: "项目名称不能为空" }));
      return;
    }
    updateProject({
      ...project,
      name,
      description: draft.description,
      taskStageMode: draft.taskStageMode,
    });
    setProjectEditDrafts((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });
    setProjectEditWarnings((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });
  };

  return (
    <div className="workspace-directory-layout">
      <section className="band workspace-directory-header">
        <div className="section-title">
          <div>
            <p className="eyebrow">工作区</p>
            <h2>我的工作区</h2>
          </div>
          <Building2 size={20} />
        </div>
        <div className="workspace-directory-create">
          <label>
            新协作工作区
            <input
              value={workspaceDraft}
              onChange={(event) => setWorkspaceDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitWorkspace();
              }}
              placeholder="例如：交付团队"
            />
          </label>
          <button className="primary-button" disabled={!workspaceDraft.trim()} onClick={submitWorkspace} type="button">
            <Plus size={16} />
            新增工作区
          </button>
        </div>
      </section>

      <section className="workspace-directory-grid" aria-label="工作区列表">
        {directoryCards.map((card) => (
          <article className="workspace-directory-card" key={card.workspace.id}>
            <div className="workspace-directory-card-head">
              <div>
                <span className="workspace-source-badge">{workspaceTypeLabel(card.workspace)}</span>
                <h2>{card.workspace.name}</h2>
              </div>
              <div className="project-overview-progress-inline">
                <strong>{card.progressPercent}%</strong>
                <span>进度</span>
              </div>
            </div>
            <div className="project-overview-meter">
              <span style={{ width: `${Math.max(0, Math.min(100, card.progressPercent))}%` }} />
            </div>
            <div className="workspace-directory-actions">
              <button className="workspace-directory-action" onClick={() => openWorkspaceModal(card.workspace.id, "projects")} type="button">
                <span>项目</span>
                <strong>{card.projects.length}</strong>
                <small>查看与新增</small>
              </button>
              <button className="workspace-directory-action" onClick={() => openWorkspaceModal(card.workspace.id, "members")} type="button">
                <span>成员</span>
                <strong>{card.memberCount}</strong>
                <small>{(card.workspace.type ?? "shared") === "private" ? "私人" : "邀请与维护"}</small>
              </button>
            </div>
          </article>
        ))}
        {directoryCards.length === 0 && <p className="empty">当前账号还没有可访问的工作区。</p>}
      </section>

      {selectedCard && activeModal?.kind === "projects" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            className="modal-panel workspace-project-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedCard.workspace.name} 项目管理`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{workspaceTypeLabel(selectedCard.workspace)}</p>
                <h2>{selectedCard.workspace.name}</h2>
                <span>这里只展示当前账号有权限访问的项目，可在此新增项目或维护项目基础资料。</span>
              </div>
              <button className="icon-button" onClick={closeModal} aria-label="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="workspace-project-create">
              <label>
                项目名称
                <input
                  value={projectDraft.name}
                  aria-invalid={Boolean(projectDraftWarning)}
                  onChange={(event) => {
                    setProjectDraft({ ...projectDraft, name: event.target.value });
                    if (projectDraftWarning) setProjectDraftWarning("");
                  }}
                  placeholder="例如：客户交付项目"
                />
                {projectDraftWarning && <span className="field-error">{projectDraftWarning}</span>}
              </label>
              <label>
                项目类型
                <select
                  value={projectDraft.taskStageMode}
                  onChange={(event) => setProjectDraft({ ...projectDraft, taskStageMode: event.target.value as TaskStageMode })}
                >
                  {taskStageModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                项目说明
                <input
                  value={projectDraft.description}
                  onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })}
                  placeholder="这个项目要达成什么"
                />
              </label>
              <button className="primary-button" onClick={submitProject} type="button">
                <Plus size={16} />
                添加项目
              </button>
            </div>

            <div className="workspace-project-list">
              {selectedCard.projects.map((projectCard) => {
                const project = projectsById.get(projectCard.projectId);
                if (!project) return null;
                const projectEditDraft = projectEditDraftFor(project);
                return (
                  <article className="workspace-project-management-card" key={project.id}>
                    <div className="workspace-project-management-head">
                      <div>
                        <strong>{project.name}</strong>
                        <span>{project.description || "这个项目还没有说明。"}</span>
                      </div>
                      <button className="secondary-button" onClick={() => openProjectDetail(project.id)} type="button">
                        进入项目
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="workspace-project-edit-grid">
                      <label>
                        项目名称
                        <input
                          aria-invalid={Boolean(projectEditWarnings[project.id])}
                          value={projectEditDraft.name}
                          onChange={(event) => updateProjectEditDraft(project, { name: event.target.value })}
                        />
                        {projectEditWarnings[project.id] && <span className="field-error">{projectEditWarnings[project.id]}</span>}
                      </label>
                      <label>
                        项目类型
                        <select
                          value={projectEditDraft.taskStageMode ?? "software"}
                          onChange={(event) => updateProjectEditDraft(project, { taskStageMode: event.target.value as TaskStageMode })}
                        >
                          {taskStageModeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        项目说明
                        <input
                          value={projectEditDraft.description}
                          onChange={(event) => updateProjectEditDraft(project, { description: event.target.value })}
                        />
                      </label>
                      <button className="secondary-button" onClick={() => saveProjectEdit(project)} type="button">
                        <Save size={16} />
                        保存项目
                      </button>
                    </div>
                    <div className="workspace-project-card-metrics">
                      <span>任务 {projectCard.taskCount}</span>
                      <span>成员 {projectCard.memberCount}</span>
                      <span>进度 {projectCard.progressPercent}%</span>
                      {projectCard.pendingReviewCount > 0 && <span className="metric-warning">待验收 {projectCard.pendingReviewCount}</span>}
                      {projectCard.riskCount > 0 && <span className="metric-danger">风险 {projectCard.riskCount}</span>}
                    </div>
                  </article>
                );
              })}
              {selectedCard.projects.length === 0 && <p className="empty">当前账号在这个工作区下还没有可见项目。</p>}
            </div>
          </section>
        </div>
      )}

      {selectedCard && activeModal?.kind === "members" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            className="modal-panel workspace-project-modal workspace-member-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedCard.workspace.name} 成员管理`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{workspaceTypeLabel(selectedCard.workspace)}</p>
                <h2>{selectedCard.workspace.name}</h2>
                <span>协作工作区成员默认可见该工作区全部项目；私人工作区不支持添加成员。</span>
              </div>
              <button className="icon-button" onClick={closeModal} aria-label="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="workspace-member-modal-body">
              <section className="workspace-edit-form">
                <div className="member-section-title">
                  <strong>工作区资料</strong>
                  <span>
                    {!canEditSelectedWorkspace
                      ? "当前账号没有工作区编辑权限"
                      : selectedWorkspaceType === "private"
                        ? "可维护名称；私人工作区属性和负责人不可变更"
                        : "可维护名称、属性和负责人"}
                  </span>
                </div>
                <div className="settings-grid">
                  <label>
                    工作区名称
                    <input
                      aria-invalid={Boolean(workspaceEditWarning.name)}
                      disabled={!canEditSelectedWorkspace}
                      value={workspaceEditDraft.name || selectedCard.workspace.name}
                      onChange={(event) => {
                        setWorkspaceEditDraft({ ...workspaceEditDraft, name: event.target.value, type: workspaceEditDraft.type ?? selectedWorkspaceType });
                        if (workspaceEditWarning.name) setWorkspaceEditWarning({ ...workspaceEditWarning, name: undefined });
                      }}
                      onFocus={() => {
                        if (!workspaceEditDraft.name) startWorkspaceEdit();
                      }}
                    />
                    {workspaceEditWarning.name && <span className="field-error">{workspaceEditWarning.name}</span>}
                  </label>
                  <label>
                    工作区属性
                    {selectedWorkspaceType === "private" ? (
                      <input disabled value="私人工作区" readOnly />
                    ) : (
                      <select
                        disabled={!canChangeSelectedWorkspaceType}
                        value={workspaceEditDraft.type || selectedWorkspaceType}
                        onFocus={() => {
                          if (!workspaceEditDraft.name) startWorkspaceEdit();
                        }}
                        onChange={(event) => {
                          const nextType = event.target.value as WorkspaceType;
                          setWorkspaceEditDraft({
                            ...workspaceEditDraft,
                            name: workspaceEditDraft.name || selectedCard.workspace.name,
                            type: nextType,
                            ownerAccountId: nextType === "private" ? selectedOwnerAccountId : editingOwnerAccountId,
                          });
                        }}
                      >
                        <option value="private" disabled={!canChangeSelectedWorkspaceType}>私人工作区</option>
                        <option value="shared">协作工作区</option>
                      </select>
                    )}
                  </label>
                  <label>
                    工作区负责人
                    <select
                      aria-invalid={Boolean(workspaceEditWarning.owner)}
                      disabled={!canChangeSelectedWorkspaceOwner || (workspaceEditDraft.type || selectedWorkspaceType) === "private"}
                      value={editingOwnerAccountId}
                      onFocus={() => {
                        if (!workspaceEditDraft.name) startWorkspaceEdit();
                      }}
                      onChange={(event) => {
                        setWorkspaceEditDraft({
                          ...workspaceEditDraft,
                          name: workspaceEditDraft.name || selectedCard.workspace.name,
                          type: workspaceEditDraft.type || selectedWorkspaceType,
                          ownerAccountId: event.target.value,
                        });
                        if (workspaceEditWarning.owner) setWorkspaceEditWarning({ ...workspaceEditWarning, owner: undefined });
                      }}
                    >
                      {selectedActiveMembers.map((member) => (
                        <option key={member.accountId} value={member.accountId}>
                          {member.name} · {member.email}
                        </option>
                      ))}
                      {!selectedActiveMembers.length && selectedOwnerAccountId && (
                        <option value={selectedOwnerAccountId}>当前负责人</option>
                      )}
                    </select>
                    {workspaceEditWarning.owner && <span className="field-error">{workspaceEditWarning.owner}</span>}
                  </label>
                </div>
                {(workspaceEditDraft.type || selectedWorkspaceType) === "private" && selectedWorkspaceType === "shared" && (
                  <p className="warning-line">保存为私人工作区后，仅负责人保留访问权限，待处理邀请会自动取消。</p>
                )}
                <div className="button-row workspace-edit-actions">
                  <button className="primary-button" disabled={!canEditSelectedWorkspace} onClick={() => void saveWorkspaceEdit()} type="button">
                    <Save size={16} />
                    保存工作区
                  </button>
                </div>
              </section>

              <section className="workspace-member-panel">
                <div className="member-section-title">
                  <strong>成员列表</strong>
                  <span>{selectedMembers.length} 人</span>
                </div>
                {selectedWorkspaceType === "private" ? (
                  <p className="muted compact-copy">私人工作区只允许本人使用，不支持添加成员。</p>
                ) : (
                  <div className="workspace-member-invite">
                    <label>
                      成员登录账号
                      <input
                        value={selectedMemberDraft.email}
                        onChange={(event) => updateWorkspaceMemberDraft(selectedCard.workspace.id, { email: event.target.value })}
                        placeholder="输入对方登录邮箱或手机号"
                      />
                    </label>
                    <button
                      className="primary-button"
                      disabled={!selectedMemberDraft.email.trim()}
                      onClick={() => {
                        inviteWorkspaceMember(selectedCard.workspace.id, selectedMemberDraft.email);
                        updateWorkspaceMemberDraft(selectedCard.workspace.id, { email: "" });
                      }}
                      type="button"
                    >
                      <Plus size={16} />
                      发送邀请
                    </button>
                  </div>
                )}
                <div className="workspace-member-list">
                  {selectedMembers.map((member) => {
                    const isOwner = member.accountId === editingOwnerAccountId || member.role === "owner";
                    const isCurrentAccount = member.accountId === currentAccount?.id;
                    const unbindDisabledReason =
                      !canEditSelectedWorkspace
                        ? "当前账号没有成员管理权限"
                        : selectedWorkspaceType === "private"
                          ? "私人工作区不支持成员解除绑定"
                          : isOwner
                            ? "负责人不能解除绑定，请先更换负责人"
                            : isCurrentAccount
                              ? "不能解除当前登录账号"
                              : "";
                    return (
                      <div className="workspace-member-row" key={member.id}>
                        <Users size={16} />
                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.email}</span>
                        </div>
                        <label className="inline-toggle">
                          <input
                            type="checkbox"
                            checked={isOwner}
                            disabled={
                              !canChangeSelectedWorkspaceOwner ||
                              selectedWorkspaceType === "private" ||
                              isOwner
                            }
                            onChange={(event) => void selectWorkspaceOwner(member.accountId, event.target.checked)}
                          />
                          负责人
                        </label>
                        <label className="inline-toggle">
                          <input type="checkbox" checked disabled readOnly />
                          执行者
                        </label>
                        <span className="workspace-member-status-pill">
                          {member.status === "active" ? "正常" : "停用"}
                        </span>
                        <button
                          className="small-button workspace-member-unbind"
                          disabled={Boolean(unbindDisabledReason)}
                          onClick={() => void unbindWorkspaceMember(member)}
                          title={unbindDisabledReason || "解除该成员的工作区访问权限"}
                          type="button"
                        >
                          <UserMinus size={14} />
                          解除绑定
                        </button>
                      </div>
                    );
                  })}
                  {!selectedMembers.length && <p className="empty">当前账号没有该工作区的成员管理权限，或暂无成员。</p>}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
