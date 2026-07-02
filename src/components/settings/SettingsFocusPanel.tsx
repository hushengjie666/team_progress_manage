import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { nowIso } from "../../appModel";
import type { BlockProfile, StrictModeStatus } from "../../types";

export function SettingsFocusPanel({
  activeProfile,
  strictStatus,
  updateProfile,
  askPermissions,
}: {
  activeProfile?: BlockProfile;
  strictStatus: StrictModeStatus | null;
  updateProfile: (profile: BlockProfile) => void;
  askPermissions: () => Promise<void>;
}) {
  const strictPlatform = strictStatus?.platform ?? "browser";
  const supportsSystemChecks = strictPlatform === "tauri_macos" || strictPlatform === "ios";
  const supportsUrlChecks = strictPlatform === "tauri_macos";

  const editProfileList = (key: "apps" | "websites", raw: string) => {
    if (!activeProfile) return;
    updateProfile({
      ...activeProfile,
      [key]: raw
        .split(/[,\n，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      updatedAt: nowIso(),
    });
  };

  return (
    <section className="band settings-panel strict-config">
      <div className="section-title">
        <div>
          <p className="eyebrow">防分心</p>
          <h2>防分心配置</h2>
        </div>
        <ShieldCheck size={20} />
      </div>
      {activeProfile && (
        <>
          <label>
            方案名称
            <input value={activeProfile.name} onChange={(event) => updateProfile({ ...activeProfile, name: event.target.value, updatedAt: nowIso() })} />
          </label>
          <label>
            屏蔽 App
            <textarea value={activeProfile.apps.join("\n")} onChange={(event) => editProfileList("apps", event.target.value)} />
          </label>
          <label>
            屏蔽网站
            <textarea value={activeProfile.websites.join("\n")} onChange={(event) => editProfileList("websites", event.target.value)} />
          </label>
          <label>
            强度
            <select
              value={activeProfile.strictness}
              onChange={(event) => updateProfile({ ...activeProfile, strictness: event.target.value as BlockProfile["strictness"], updatedAt: nowIso() })}
            >
              <option value="soft">软严格</option>
              <option value="balanced">违规暂停确认</option>
              <option value="locked">连续违规作废</option>
            </select>
          </label>
          <div className="strict-behavior">
            <p><strong>软严格：</strong>只记录违规，不打断当前番茄。</p>
            <p><strong>违规暂停：</strong>检测到分心源后暂停计时，需要用户确认再继续。</p>
            <p><strong>连续违规作废：</strong>同一番茄连续 3 次命中后自动作废。</p>
          </div>
        </>
      )}
      <button className="primary-button" onClick={() => void askPermissions()}>
        <ShieldQuestion size={16} />
        检查权限
      </button>
      <div className="permission-checklist">
        <span className={strictStatus?.permission_state === "granted" ? "ok" : ""}>辅助功能权限</span>
        <span className={supportsSystemChecks ? "ok" : ""}>
          前台 App 检测：{supportsSystemChecks ? "可用" : "未启用"}
        </span>
        <span className={supportsUrlChecks ? "ok" : ""}>Chrome/Safari URL 读取：{supportsUrlChecks ? "可用" : "未启用"}</span>
      </div>
      <p className="muted">
        {strictStatus?.message ??
          "浏览器预览仅支持软降级记录；Tauri 仅在有权限时做前台/App 监测与可选 URL 检测。"}
      </p>
    </section>
  );
}
