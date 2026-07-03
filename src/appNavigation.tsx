import {
  BarChart3,
  Building2,
  CalendarDays,
  Focus,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  UserCheck,
  Users,
} from "lucide-react";
import type { AppTopbarNavItem } from "./components/AppTopbar";

export type AppNavigationHandlers = {
  openBoard: () => void;
  openWorkspaces: () => void;
  openMemberStatus: () => void;
  openWorkbench: () => void;
  openFocus: () => void;
  openDailyReview: () => void;
  openReports: () => void;
  openCalendar: () => void;
  openAdmin: () => void;
  showMemberStatus?: boolean;
};

export const createAppNavigation = ({
  openBoard,
  openWorkspaces,
  openMemberStatus,
  openWorkbench,
  openFocus,
  openDailyReview,
  openReports,
  openCalendar,
  openAdmin,
  showMemberStatus = true,
}: AppNavigationHandlers) => {
  const adminNavItem: AppTopbarNavItem = {
    key: "admin",
    label: "管理中心",
    icon: <FolderKanban size={18} />,
    onClick: openAdmin,
  };

  const boardNavItem: AppTopbarNavItem = { key: "board", label: "项目总览", icon: <LayoutDashboard size={18} />, onClick: openBoard };
  const workspacesNavItem: AppTopbarNavItem = { key: "workspaces", label: "工作区", icon: <Building2 size={18} />, onClick: openWorkspaces };
  const memberStatusNavItem: AppTopbarNavItem = { key: "member_status", label: "成员状况", icon: <Users size={18} />, onClick: openMemberStatus };
  const workbenchNavItem: AppTopbarNavItem = { key: "workbench", label: "我的任务", icon: <UserCheck size={18} />, onClick: openWorkbench };

  const primaryNavItems: AppTopbarNavItem[] = [
    boardNavItem,
    workspacesNavItem,
    ...(showMemberStatus ? [memberStatusNavItem] : []),
    workbenchNavItem,
  ];

  const secondaryNavItems: AppTopbarNavItem[] = [
    { key: "focus", label: "开始工作", icon: <Focus size={18} />, onClick: openFocus },
    { key: "daily", label: "每日总结", icon: <ListChecks size={18} />, onClick: openDailyReview },
    { key: "reports", label: "复盘洞察", icon: <BarChart3 size={18} />, onClick: openReports },
    { key: "calendar", label: "历史日报", icon: <CalendarDays size={18} />, onClick: openCalendar },
    adminNavItem,
  ];

  const topbarNavItems = [...primaryNavItems, ...secondaryNavItems];
  return { topbarNavItems };
};
