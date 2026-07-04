import type { SettingsSection } from "./settingsTypes";

const settingsSections: { key: SettingsSection; label: string }[] = [
  { key: "members", label: "成员管理" },
  { key: "timer", label: "计时偏好" },
  { key: "backend", label: "团队后台" },
  { key: "demo", label: "演示数据" },
];

export const effectiveSettingsSection = (
  activeSection: SettingsSection,
  canManageMembers: boolean,
) => !canManageMembers && activeSection === "members" ? "backend" : activeSection;

export function SettingsSectionTabs({
  activeSection,
  canManageMembers,
  setActiveSection,
}: {
  activeSection: SettingsSection;
  canManageMembers: boolean;
  setActiveSection: (section: SettingsSection) => void;
}) {
  const effectiveSection = effectiveSettingsSection(activeSection, canManageMembers);
  const sectionNav = settingsSections.filter((section) => canManageMembers || section.key !== "members");

  return (
    <div className="segmented settings-section-tabs">
      {sectionNav.map((section) => (
        <button
          className={effectiveSection === section.key ? "active" : ""}
          key={section.key}
          onClick={() => setActiveSection(section.key)}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}
