import { describe, expect, it } from "vitest";
import { createInitialState } from "../seed";
import {
  memberStatusDailyPlan,
  memberStatusMember,
  memberStatusProject,
  memberStatusTask,
} from "../test/memberStatusFixtures";
import {
  buildMemberStatusColumns,
  buildMemberStatusPeople,
} from "./MemberStatusView";

describe("member status view model", () => {
  it("merges the same account across projects even when team member ids differ", () => {
    const timeManageMember = memberStatusMember({
      id: "member_time_manage_owner",
      projectId: "project_time_manage",
    });
    const imageMember = memberStatusMember({
      id: "member_image_owner",
      projectId: "project_image",
    });

    const people = buildMemberStatusPeople([timeManageMember, imageMember]);

    expect(people).toHaveLength(1);
    expect(people[0].memberIds).toEqual(["member_time_manage_owner", "member_image_owner"]);
    expect(people[0].projectIds).toEqual(["project_time_manage", "project_image"]);
  });

  it("shows all project groups for a merged member's today tasks", () => {
    const state = createInitialState();
    const timeManage = memberStatusProject("project_time_manage", "TimeManage");
    const imageRecognition = memberStatusProject("project_image", "图像识别");
    const timeManageMember = memberStatusMember({
      id: "member_time_manage_owner",
      projectId: timeManage.id,
    });
    const imageMember = memberStatusMember({
      id: "member_image_owner",
      projectId: imageRecognition.id,
    });
    const timeManageTask = memberStatusTask({
      id: "task_time_manage",
      title: "完成工作台信息精简",
      projectId: timeManage.id,
      project: timeManage.name,
      primaryExecutorMemberId: timeManageMember.id,
      sortOrder: 1,
    });
    const imageTask = memberStatusTask({
      id: "task_image",
      title: "验证本地团队后台",
      projectId: imageRecognition.id,
      project: imageRecognition.name,
      primaryExecutorMemberId: imageMember.id,
      sortOrder: 2,
    });

    const columns = buildMemberStatusColumns({
      ...state,
      projects: [timeManage, imageRecognition],
      projectMembers: [timeManageMember, imageMember],
      tasks: [timeManageTask, imageTask],
      dailyPlans: [memberStatusDailyPlan([timeManageTask.id, imageTask.id])],
    });

    expect(columns).toHaveLength(1);
    expect(columns[0].displayedTasks.map((item) => item.id)).toEqual(["task_time_manage", "task_image"]);
    expect(columns[0].projectTaskGroups.map((group) => group.projectName)).toEqual(["TimeManage", "图像识别"]);
    expect(columns[0].projectTaskGroups.map((group) => group.roleLabel)).toEqual(["项目负责人", "项目负责人"]);
  });

  it("keeps roles on each project group instead of the member header", () => {
    const state = createInitialState();
    const timeManage = memberStatusProject("project_time_manage", "TimeManage");
    const imageRecognition = memberStatusProject("project_image", "图像识别");
    const timeManageMember = memberStatusMember({
      id: "member_time_manage_executor",
      projectId: timeManage.id,
      roles: ["executor"],
    });
    const imageMember = memberStatusMember({
      id: "member_image_owner",
      projectId: imageRecognition.id,
      roles: ["project_owner", "executor"],
    });
    const timeManageTask = memberStatusTask({
      id: "task_time_manage",
      title: "完成工作台信息精简",
      projectId: timeManage.id,
      project: timeManage.name,
      primaryExecutorMemberId: timeManageMember.id,
      sortOrder: 1,
    });
    const imageTask = memberStatusTask({
      id: "task_image",
      title: "验证图像识别团队数据流转",
      projectId: imageRecognition.id,
      project: imageRecognition.name,
      primaryExecutorMemberId: imageMember.id,
      sortOrder: 2,
    });

    const columns = buildMemberStatusColumns({
      ...state,
      projects: [timeManage, imageRecognition],
      projectMembers: [timeManageMember, imageMember],
      tasks: [timeManageTask, imageTask],
      dailyPlans: [memberStatusDailyPlan([timeManageTask.id, imageTask.id])],
    });

    expect(columns[0].projectTaskGroups.map((group) => [group.projectName, group.roleLabel])).toEqual([
      ["TimeManage", "执行者"],
      ["图像识别", "项目负责人"],
    ]);
  });

  it("shows completed tasks in the member today task list", () => {
    const state = createInitialState();
    const imageRecognition = memberStatusProject("project_image", "图像识别");
    const imageMember = memberStatusMember({
      id: "member_image_owner",
      projectId: imageRecognition.id,
    });
    const runningTask = memberStatusTask({
      id: "task_running",
      title: "验证图像识别团队数据流转",
      projectId: imageRecognition.id,
      project: imageRecognition.name,
      primaryExecutorMemberId: imageMember.id,
      status: "in_progress",
      sortOrder: 1,
    });
    const completedTask = memberStatusTask({
      id: "task_completed",
      title: "完成工作台信息精简",
      projectId: imageRecognition.id,
      project: imageRecognition.name,
      primaryExecutorMemberId: imageMember.id,
      status: "completed",
      sortOrder: 2,
    });

    const columns = buildMemberStatusColumns({
      ...state,
      projects: [imageRecognition],
      projectMembers: [imageMember],
      tasks: [runningTask, completedTask],
      dailyPlans: [memberStatusDailyPlan([runningTask.id, completedTask.id])],
    });

    expect(columns).toHaveLength(1);
    expect(columns[0].displayedTasks.map((item) => item.id)).toEqual(["task_running", "task_completed"]);
    expect(columns[0].projectTaskGroups[0].tasks.map((item) => item.id)).toEqual(["task_running", "task_completed"]);
  });
});
