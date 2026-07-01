import {
  BarChart3,
  CalendarDays,
  Focus,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";
import type { AppTopbarNavItem } from "./components/AppTopbar";
import type { Project } from "./types";
import type { Tab } from "./appModel";

export type AppNavigationHandlers = {
  openBoard: () => void;
  openMemberStatus: () => void;
  openWorkbench: () => void;
  openFocus: () => void;
  openDailyReview: () => void;
  openReports: () => void;
  openCalendar: () => void;
  openAdmin: () => void;
  logout: () => void;
  showMemberStatus?: boolean;
};

export const createAppNavigation = ({
  openBoard,
  openMemberStatus,
  openWorkbench,
  openFocus,
  openDailyReview,
  openReports,
  openCalendar,
  openAdmin,
  logout,
  showMemberStatus = true,
}: AppNavigationHandlers) => {
  const adminNavItem: AppTopbarNavItem = {
    key: "admin",
    label: "管理中心",
    icon: <FolderKanban size={18} />,
    onClick: openAdmin,
  };

  const primaryNavItems: AppTopbarNavItem[] = [
    { key: "board", label: "项目总览", icon: <LayoutDashboard size={18} />, onClick: openBoard },
    ...(showMemberStatus ? [{ key: "member_status", label: "成员状况", icon: <Users size={18} />, onClick: openMemberStatus }] : []),
    { key: "workbench", label: "我的任务", icon: <UserCheck size={18} />, onClick: openWorkbench },
  ];

  const secondaryNavItems: AppTopbarNavItem[] = [
    { key: "focus", label: "开始工作", icon: <Focus size={18} />, onClick: openFocus },
    { key: "daily", label: "每日总结", icon: <ListChecks size={18} />, onClick: openDailyReview },
    { key: "reports", label: "复盘洞察", icon: <BarChart3 size={18} />, onClick: openReports },
    { key: "calendar", label: "历史日报", icon: <CalendarDays size={18} />, onClick: openCalendar },
    adminNavItem,
  ];

  const topbarNavItems = [...primaryNavItems, ...secondaryNavItems];
  const mobileNavItems = [...primaryNavItems.slice(0, 3), secondaryNavItems[0]].slice(0, 4);
  const mobileMoreItems: AppTopbarNavItem[] = [
    secondaryNavItems[1],
    secondaryNavItems[2],
    secondaryNavItems[3],
    adminNavItem,
    { key: "logout", label: "退出登录", icon: <Settings size={18} />, onClick: logout },
  ];

  return { topbarNavItems, mobileNavItems, mobileMoreItems };
};

export const mobileTitleForNavigation = ({
  tab,
  activeNavKey,
  activeProject,
}: {
  tab: Tab;
  activeNavKey: string;
  activeProject?: Project;
}) => {
  if (tab === "project") {
    return {
      title: activeProject?.name ?? "项目工作区",
      subtitle: activeProject?.description || "项目工作区",
    };
  }

  const titleByNav: Record<string, string> = {
    board: "项目总览",
    member_status: "成员状况",
    workbench: "我的任务",
    admin: "管理中心",
    focus: "开始工作",
    calendar: "历史日报",
    daily: "每日总结",
    reports: "复盘洞察",
  };

  return {
    title: titleByNav[activeNavKey] ?? "团队进度",
    subtitle: undefined,
  };
};
