import type { Project, ProjectMember, TaskTemplate } from "./types";

const now = () => new Date().toISOString();

export const starterProject: Project = {
  id: "project_starter",
  name: "TimeManage 团队进度",
  description: "从个人时间管理迁移而来的团队进度管控起始项目。",
  defaultExpectedStartHours: 24,
  taskStageMode: "software",
  sortOrder: 0,
  createdAt: now(),
  updatedAt: now(),
};

export const starterProjectMember: ProjectMember = {
  id: "member_owner",
  projectId: starterProject.id,
  accountId: "account_owner",
  name: "项目负责人",
  email: "owner@example.com",
  roles: ["project_owner", "executor"],
  status: "active",
  createdAt: now(),
  updatedAt: now(),
};

export const defaultTaskTemplates: TaskTemplate[] = [
  {
    id: "template_morning_plan",
    name: "晨间计划",
    description: "启动当天承诺、检查提醒、留出缓冲。",
    project: "个人节奏",
    tags: ["计划", "晨间"],
    priority: "high",
    severity: "medium",
    estimatePomodoros: 1,
    subtasks: ["查看昨日回顾", "选择今日 1-3 个承诺", "开启第一颗番茄"],
    repeatRule: "daily",
  },
  {
    id: "template_weekly_review",
    name: "周复盘",
    description: "回顾完成率、估算偏差和下周容量。",
    project: "复盘",
    tags: ["周复盘", "报告"],
    priority: "high",
    severity: "high",
    estimatePomodoros: 2,
    subtasks: ["检查承诺兑现率", "记录低估任务类型", "调整下周屏蔽清单"],
    repeatRule: "weekly",
  },
  {
    id: "template_deep_dev",
    name: "开发专注",
    description: "用于需要连续推进的开发任务。",
    project: "开发",
    tags: ["开发", "深度工作"],
    priority: "high",
    severity: "high",
    estimatePomodoros: 4,
    subtasks: ["明确验收点", "实现最小闭环", "运行测试", "记录遗留问题"],
  },
  {
    id: "template_learning",
    name: "学习计划",
    description: "读资料、做笔记、输出练习。",
    project: "学习",
    tags: ["学习", "输入"],
    priority: "medium",
    severity: "medium",
    estimatePomodoros: 3,
    subtasks: ["阅读资料", "整理笔记", "做一次输出练习"],
  },
];
