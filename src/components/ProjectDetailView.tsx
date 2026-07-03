import { TaskDetailModal } from "./taskDetail/TaskDetailModal";
import { ProjectDetailHero } from "./projectDetail/ProjectDetailHero";
import { ProjectDetailMembersTab } from "./projectDetail/ProjectDetailMembersTab";
import { ProjectDetailOverviewTab } from "./projectDetail/ProjectDetailOverviewTab";
import { ProjectDetailScheduleTab } from "./projectDetail/ProjectDetailScheduleTab";
import { ProjectDetailTasksTab } from "./projectDetail/ProjectDetailTasksTab";
import { ProjectSettingsPanel } from "./projectDetail/ProjectSettingsPanel";
import { ProjectTaskCreateDialog } from "./projectDetail/ProjectTaskCreateDialog";
import type { ProjectDetailViewProps } from "./projectDetail/projectDetailViewTypes";
import { useProjectDetailController } from "./projectDetail/useProjectDetailController";

export type { ProjectDetailTab, ProjectDetailViewProps } from "./projectDetail/projectDetailViewTypes";

export function ProjectDetailView(props: ProjectDetailViewProps) {
  const detail = useProjectDetailController(props);

  if (!detail.hasModel) {
    return (
      <section className="band project-detail-shell">
        <p className="empty">项目不存在或已被删除。</p>
        <button className="secondary-button" onClick={props.backToBoard}>返回项目总览</button>
      </section>
    );
  }

  return (
    <div className="project-detail-layout">
      <ProjectDetailHero
        projectName={detail.project.name}
        workspaceTagLabel={detail.workspaceTagLabel}
        activeTab={detail.activeTab}
        canShowProjectMemberManagement={detail.canShowProjectMemberManagement}
        setActiveTab={props.setActiveTab}
        progressPercent={detail.board.projectProgress}
        taskCount={detail.allProjectTasks.length}
        memberCount={detail.accessibleMemberCount}
        pendingReviewCount={detail.taskCounts.pending_review}
      />

      {detail.activeTab === "overview" && (
        <ProjectDetailOverviewTab
          overviewTasks={detail.overviewTasks}
          acceptedTasks={detail.acceptedTasks}
          projectMembers={detail.projectMembers}
          todayTaskIds={detail.todayPlan?.committedTaskIds ?? []}
          activeProjectTaskIds={detail.activeProjectTaskIds}
          taskStageMode={detail.projectStageMode}
          canEditTasks={detail.access.canEditTasks}
          board={detail.board}
          riskSections={detail.riskSections}
          riskTaskCount={detail.riskTaskCount}
          selectTask={props.selectTask}
          openCreateTaskDialog={detail.openCreateTaskDialog}
        />
      )}

      {detail.activeTab === "tasks" && (
        <ProjectDetailTasksTab
          filters={detail.filters}
          setFilters={detail.setFilters}
          showFilters={detail.showFilters}
          toggleFilters={() => detail.setShowFilters((value) => !value)}
          executors={detail.executors}
          filteredTasks={detail.filteredTasks}
          projectMembers={detail.projectMembers}
          canEditTasks={detail.access.canEditTasks}
          canReviewTasks={detail.access.canReviewTasks}
          selectTask={props.selectTask}
          beginFocus={props.beginFocus}
          updateStatus={detail.updateStatus}
          updateTaskAssignment={props.updateTaskAssignment}
          openCreateTaskDialog={detail.openCreateTaskDialog}
        />
      )}

      {detail.activeTab === "schedule" && (
        <ProjectDetailScheduleTab
          projectName={detail.project.name}
          allProjectTasks={detail.allProjectTasks}
          projectMembers={detail.projectMembers}
          activeProjectTaskIds={detail.activeProjectTaskIds}
          todayTaskIds={detail.todayPlan?.committedTaskIds ?? []}
          taskStageMode={detail.projectStageMode}
          selectTask={props.selectTask}
        />
      )}

      {detail.canShowProjectMemberManagement && detail.activeTab === "members" && (
        <ProjectDetailMembersTab
          project={detail.project}
          isPrivateProject={detail.isPrivateProject}
          canManageProjectMembers={detail.canManageProjectMembers}
          memberOverviewStats={detail.memberOverviewStats}
          accessibleProjectMembers={detail.accessibleProjectMembers}
          showAddMemberDialog={detail.showAddMemberDialog}
          openAddMemberDialog={detail.openAddMemberDialog}
          closeAddMemberDialog={detail.closeAddMemberDialog}
          inviteProjectMember={props.inviteProjectMember}
          updateMemberRole={detail.updateMemberRole}
          updateProjectMember={props.updateProjectMember}
        />
      )}

      {detail.activeTab === "settings" && (
        <ProjectSettingsPanel
          settings={detail.editableProjectSettings}
          workspaceOptions={detail.workspaceOptions}
          canEdit={detail.access.canReviewTasks}
          updateSettings={detail.updateSettingsDraft}
          saveSettings={detail.saveProjectSettings}
        />
      )}

      <TaskDetailModal
        task={props.selectedTask?.projectId === detail.project.id ? props.selectedTask : undefined}
        projects={props.allProjects}
        projectMembers={props.allProjectMembers}
        updateTask={props.updateTask}
        updateTaskAssignment={props.updateTaskAssignment}
        updateTaskProgress={props.updateTaskProgress}
        acceptTask={props.acceptTask}
        returnTaskForReview={props.returnTaskForReview}
        close={() => props.selectTask(null)}
        splitTask={props.splitTask}
        canEdit={detail.access.canEditTasks}
        canReview={detail.access.canReviewTasks}
        lockProject
      />
      <ProjectTaskCreateDialog
        open={detail.showCreateTaskDialog}
        draft={detail.draft}
        members={detail.projectMembers}
        executors={detail.executors}
        taskStageMode={detail.projectStageMode}
        canEdit={detail.access.canEditTasks}
        setDraft={detail.setDraft}
        onCancel={detail.closeCreateTaskDialog}
        onConfirm={detail.createTask}
      />
    </div>
  );
}
