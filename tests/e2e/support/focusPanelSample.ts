import { startTimerInState } from "../../../src/appModel";
import type { Task } from "../../../src/types";
import { authenticatedState } from "./authenticatedState";

export function focusPanelSample() {
  const state = authenticatedState();
  const current = state.tasks[0];
  const reviewProject = {
    ...state.projects[0], id: "project_delivery",
    name: "交付验收 · " + "ReleaseReadiness".repeat(5), autoAcceptCompletedTasks: false,
  };
  state.projects.push(reviewProject);
  state.projectMembers.push({ ...state.projectMembers[0], id: "delivery_member", projectId: reviewProject.id });

  function addTask(title: string, status: Task["status"], delivery = false) {
    const index = state.tasks.length;
    const project = delivery ? reviewProject : state.projects[0];
    const task: Task = {
      ...current, id: `focus_panel_${index}`, sortOrder: 10 + index, title, status,
      projectId: project.id, project: project.name, primaryExecutorMemberId: delivery ? "delivery_member" : current.primaryExecutorMemberId,
      progressPercent: status === "completed" ? 100 : 0,
    };
    state.tasks.push(task);
    state.dailyPlans[0].committedTaskIds.push(task.id);
  }

  addTask("核对本周交付清单", "committed");
  addTask("提交验收材料", "pending_review");
  addTask("整理访谈记录", "completed");
  addTask("核对发布记录 " + "ReleaseCandidate".repeat(8), "committed", true);
  for (const title of ["接口清单", "测试记录", "验收纪要", "迭代计划", "回归报告", "交接说明", "版本记录", "交付文档"]) {
    addTask(`归档${title}`, "completed", true);
  }
  return startTimerInState(state, "focus", current.id, new Date().toISOString(), "focus_panel_session",
    { workSessionId: "focus_panel_work" });
}
