import type { Task, TaskStage, TaskStageMode } from "./types";

const keepsTimeManageDemoLanguage = (projectName: string) => /timemanage/i.test(projectName) || projectName.includes("时间管理");

const softwareToRegularStage: Record<TaskStage, TaskStage> = {
  planning: "planning",
  execution: "execution",
  check: "check",
  sales: "planning",
  requirements: "planning",
  design: "planning",
  development: "execution",
  testing: "check",
  deployment: "execution",
  acceptance: "check",
};

const regularToSoftwareStage: Record<TaskStage, TaskStage> = {
  planning: "requirements",
  execution: "development",
  check: "testing",
  sales: "sales",
  requirements: "requirements",
  design: "design",
  development: "development",
  testing: "testing",
  deployment: "deployment",
  acceptance: "acceptance",
};

export const normalizeDemoTaskStage = (stage: TaskStage, mode: TaskStageMode): TaskStage =>
  mode === "regular" ? softwareToRegularStage[stage] : regularToSoftwareStage[stage];

export const fallbackDemoTaskNotes = (task: Task, projectName: string) =>
  `围绕${projectName}推进「${task.title}」，补齐背景、执行口径和验收要点，确保演示数据可以直接用于功能体验。`;

export const fallbackDemoTaskProgressNote = (task: Task) => {
  if (task.status === "completed") return "演示任务已完成，用于展示历史完成记录。";
  if (task.status === "in_progress") return "演示任务正在推进中，用于展示当前工作状态和进度变化。";
  if (task.status === "committed") return "演示任务已进入今日队列，用于展示待执行任务。";
  if (task.status === "pending_review") return "演示任务等待负责人验收。";
  return "演示任务已进入任务池，可用于安排和分配。";
};

export const targetProjectDemoTaskPatch = (task: Task, projectName: string): Partial<Task> => {
  if (keepsTimeManageDemoLanguage(projectName)) return {};

  const projectLabel = projectName.replace(/系统|项目/g, "").trim() || projectName;
  const patches: Record<string, Partial<Task>> = {
    demo_task_today_deep: {
      title: `完成${projectLabel}样例集核验`,
      notes: `核对${projectName}的核心样例、异常样例和验收口径，确保今天能看到真实项目进展。`,
      tags: ["验收", "样例"],
      stage: "testing",
    },
    demo_task_today_sync: {
      title: `验证${projectLabel}团队数据流转`,
      notes: `确认${projectName}的任务分配、进度更新和成员协作记录能正常保存并刷新。`,
      tags: ["协作", "验收"],
      stage: "testing",
    },
    demo_task_today_report: {
      title: `整理${projectLabel}验收报告`,
      notes: `汇总今日测试结论、风险点和下一步处理项，方便团队对齐项目状态。`,
      tags: ["报告", "验收"],
      stage: "acceptance",
    },
    demo_task_pool_calendar: {
      title: `补齐${projectLabel}空状态检查`,
      notes: `检查无数据、加载失败和部分结果缺失时的提示是否清晰。`,
      tags: ["体验", "测试"],
      stage: "testing",
    },
    demo_task_pool_import: {
      title: `完善${projectLabel}后台诊断提示`,
      notes: `把服务健康、登录状态和后台结果展示得更清楚，方便团队快速定位问题。`,
      tags: ["后台", "诊断"],
      stage: "requirements",
    },
    demo_task_pool_shortcuts: {
      title: `整理${projectLabel}常用操作清单`,
      notes: `把测试、验收、回退和问题记录的常用动作整理成可执行清单。`,
      tags: ["效率", "流程"],
      stage: "requirements",
    },
    demo_task_pool_weekly: {
      title: `准备${projectLabel}周计划模板`,
      notes: `固定整理本周验收结论、遗留问题、风险变化和下周计划。`,
      tags: ["周会", "模板"],
      stage: "acceptance",
    },
    demo_task_done_prd: {
      title: `整理${projectLabel}首版需求`,
      tags: ["需求"],
      stage: "requirements",
    },
    demo_task_done_nav: {
      title: `完成${projectLabel}流程梳理`,
      tags: ["流程", "协作"],
      stage: "design",
    },
    demo_task_done_focus: {
      title: `完成${projectLabel}核心用例验证`,
      tags: ["验证", "核心流程"],
      stage: "testing",
    },
    demo_task_done_review: {
      title: `设计${projectLabel}验收说明字段`,
      tags: ["验收", "字段"],
      stage: "acceptance",
    },
  };

  return patches[task.id] ?? {};
};
