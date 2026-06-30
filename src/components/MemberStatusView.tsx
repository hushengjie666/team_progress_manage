import { labelTaskStage, today } from "../appModel";
import {
  stageTaskSortRank,
  stageTaskStatusLabel,
} from "../projectTaskDisplay";
import { projectToneClassName } from "../projectVisuals";
import type { AppState, ProjectMemberRole, Task } from "../types";

type MemberProjectTaskGroup = {
  projectId: string;
  projectName: string;
  tasks: Task[];
};

type MemberStatusPerson = {
  id: string;
  name: string;
  roles: ProjectMemberRole[];
  memberIds: string[];
  projectIds: string[];
};

const groupMemberTasksByProject = (projectIds: string[], tasks: Task[], projectNameById: Map<string, string>): MemberProjectTaskGroup[] => {
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
      tasks: [],
    };
    groups.set(projectId, group);
    return group;
  };

  projectIds.forEach((projectId) => ensureGroup(projectId));
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

export function MemberStatusView({
  state,
  projectId,
  selectTask,
}: {
  state: AppState;
  projectId?: string;
  selectTask: (taskId: string | null) => void;
}) {
  const sourceProjectMembers = state.projectMembers.filter((member) => (!projectId || member.projectId === projectId) && member.status !== "disabled");
  const members = Array.from(
    sourceProjectMembers.reduce((acc, member) => {
      const key = member.teamMemberId ?? member.accountId ?? member.email ?? member.name;
      const existing = acc.get(key);
      acc.set(key, {
        id: key,
        name: existing?.name ?? member.name,
        roles: Array.from(new Set([...(existing?.roles ?? []), ...member.roles])),
        memberIds: [...(existing?.memberIds ?? []), member.id],
        projectIds: Array.from(new Set([...(existing?.projectIds ?? []), member.projectId])),
      });
      return acc;
    }, new Map<string, MemberStatusPerson>()),
  ).map(([, member]) => member);
  const sourceTasks = state.tasks.filter((task) =>
    task.status !== "split" &&
    task.status !== "archived" &&
    (!projectId || task.projectId === projectId),
  );
  const todayPlan = state.dailyPlans.find((plan) => plan.date === today());
  const todayTaskIdSet = new Set((todayPlan?.committedTaskIds ?? []).filter((taskId) => sourceTasks.some((task) => task.id === taskId)));
  const activeSessions = state.workSessions
    .filter((session) => session.status === "active" && sourceTasks.some((task) => task.id === session.taskId))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const projectNameById = new Map(state.projects.map((project) => [project.id, project.name]));

  return (
    <section className="band member-status-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">成员状况</p>
          <h2>今日任务清单</h2>
        </div>
        <span className="count-pill">{todayTaskIdSet.size}</span>
      </div>
      <div className="member-status-board" aria-label="成员今日任务列">
        {members.map((member) => {
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
          const projectTaskGroups = groupMemberTasksByProject(member.projectIds, displayedTasks, projectNameById)
            .filter((group) => group.tasks.length > 0);

          return (
            <article className="member-status-column" key={member.id}>
              <div className="member-status-heading">
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.roles.includes("project_owner") ? "项目负责人" : "执行者"}</span>
                </div>
                <span>{displayedTasks.length}</span>
              </div>
              <div className="member-task-list">
                {projectTaskGroups.map((group) => (
                  <section
                    className={[
                      "member-project-task-group",
                      projectToneClassName(group.projectId),
                    ].filter(Boolean).join(" ")}
                    key={group.projectId}
                  >
                    <div className="member-project-task-heading">
                      <strong>{group.projectName}</strong>
                      <span>{group.tasks.length}</span>
                    </div>
                    <div className="member-project-task-list">
                      {group.tasks.map((task) => {
                        const isRunning = task.id === runningTask?.id;
                        return (
                          <button className={isRunning ? "member-task-item running" : "member-task-item"} key={task.id} onClick={() => selectTask(task.id)}>
                            <span className="member-task-title-row">
                              <strong>{task.title}</strong>
                              {isRunning && <span className="member-task-state">执行中</span>}
                            </span>
                            <span className="member-task-meta">{stageTaskStatusLabel(task.status)} · {labelTaskStage[task.stage]} · {task.progressPercent ?? 0}%</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {displayedTasks.length === 0 && <p className="empty">今日没有项目任务。</p>}
              </div>
            </article>
          );
        })}
        {members.length === 0 && <p className="empty">暂无成员。</p>}
      </div>
    </section>
  );
}
