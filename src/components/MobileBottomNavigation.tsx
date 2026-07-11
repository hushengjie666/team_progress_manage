import { MoreHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { AppTopbarNavItem } from "./AppTopbar";

const primaryKeys = ["board", "workbench", "focus", "member_status"];

export function MobileBottomNavigation({
  navItems,
  activeNavKey,
  moreActions,
}: {
  navItems: AppTopbarNavItem[];
  activeNavKey: string;
  moreActions: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryItems = primaryKeys.map((key) => navItems.find((item) => item.key === key)).filter(Boolean) as AppTopbarNavItem[];
  const moreItems = navItems.filter((item) => !primaryKeys.includes(item.key));
  const moreActive = moreItems.some((item) => item.key === activeNavKey);

  return (
    <>
      {moreOpen && (
        <div className="mobile-more-backdrop" role="presentation" onClick={() => setMoreOpen(false)}>
          <section className="mobile-more-sheet" role="dialog" aria-label="更多功能" onClick={(event) => event.stopPropagation()}>
            <header>
              <strong>更多</strong>
              <button className="link-button" type="button" onClick={() => setMoreOpen(false)}>关闭</button>
            </header>
            <div className="mobile-more-grid">
              {moreItems.map((item) => (
                <button
                  className={activeNavKey === item.key ? "active" : ""}
                  key={item.key}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setMoreOpen(false);
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="mobile-more-actions">{moreActions}</div>
          </section>
        </div>
      )}
      <nav className="mobile-bottom-nav" aria-label="手机页面导航">
        {primaryItems.map((item) => (
          <button className={activeNavKey === item.key ? "active" : ""} onClick={item.onClick} key={item.key} type="button">
            {item.icon}
            <span>{item.key === "board" ? "总览" : item.key === "focus" ? "专注" : item.key === "member_status" ? "成员" : item.label}</span>
          </button>
        ))}
        <button className={moreActive || moreOpen ? "active" : ""} onClick={() => setMoreOpen(true)} type="button">
          <MoreHorizontal size={19} />
          <span>更多</span>
        </button>
      </nav>
    </>
  );
}
