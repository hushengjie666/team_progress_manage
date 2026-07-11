import type { ReactNode } from "react";
import { MobileBottomNavigation } from "./MobileBottomNavigation";

export type AppTopbarNavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

export function AppTopbar({
  navItems,
  activeNavKey,
  actions,
}: {
  navItems: AppTopbarNavItem[];
  activeNavKey: string;
  actions: ReactNode;
}) {
  return (
    <>
      <header className="topbar">
        <nav className="topbar-nav" aria-label="页面导航">
          {navItems.map((item) => (
            <button className={activeNavKey === item.key ? "active" : ""} onClick={item.onClick} key={item.key}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="topbar-actions">{actions}</div>
      </header>
      <MobileBottomNavigation navItems={navItems} activeNavKey={activeNavKey} moreActions={actions} />
    </>
  );
}
