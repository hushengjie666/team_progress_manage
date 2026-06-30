import { Menu, MoreHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

export type AppTopbarNavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

export function AppTopbar({
  navItems,
  mobileNavItems,
  mobileMoreItems,
  activeNavKey,
  mobileTitle,
  mobileSubtitle,
  actions,
  mobileActions,
}: {
  navItems: AppTopbarNavItem[];
  mobileNavItems?: AppTopbarNavItem[];
  mobileMoreItems?: AppTopbarNavItem[];
  activeNavKey: string;
  mobileTitle: string;
  mobileSubtitle?: string;
  actions: ReactNode;
  mobileActions?: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const bottomItems = mobileNavItems ?? navItems.slice(0, 4);
  const moreItems = mobileMoreItems ?? navItems.slice(4);

  return (
    <>
      <header className="topbar">
        <div className="mobile-topbar-title">
          <span className="mobile-menu-mark" aria-hidden="true">
            <Menu size={18} />
          </span>
          <div>
            <strong>{mobileTitle}</strong>
            {mobileSubtitle && <span>{mobileSubtitle}</span>}
          </div>
        </div>
        <nav className="topbar-nav" aria-label="页面导航">
          {navItems.map((item) => (
            <button className={activeNavKey === item.key ? "active" : ""} onClick={item.onClick} key={item.key}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="topbar-actions">{actions}</div>
        <div className="mobile-topbar-actions">{mobileActions ?? actions}</div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="移动端主导航">
        {bottomItems.map((item) => (
          <button
            className={activeNavKey === item.key ? "active" : ""}
            key={item.key}
            onClick={() => {
              setMoreOpen(false);
              item.onClick();
            }}
            type="button"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button className={moreOpen ? "active" : ""} onClick={() => setMoreOpen((open) => !open)} type="button">
          <MoreHorizontal size={18} />
          <span>更多</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-more-menu" role="menu">
          {moreItems.map((item) => (
            <button
              className={activeNavKey === item.key ? "active" : ""}
              key={item.key}
              onClick={() => {
                setMoreOpen(false);
                item.onClick();
              }}
              role="menuitem"
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
