import { AlarmClock, Bell, Sparkles } from "lucide-react";
import type { Settings } from "../../types";

export function SettingsTimerPanel({
  dailyGoal,
  settings,
  updateSettings,
  askNotificationPermissions,
}: {
  dailyGoal: number;
  settings: Settings;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  askNotificationPermissions: () => Promise<void>;
}) {
  return (
    <>
      <section className="band settings-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">个人偏好</p>
            <h2>个人启动配置</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <p className="muted">
          当前个人计时节奏：每天 {dailyGoal} 个番茄；偏好 {settings.focusMinutes} 分钟。
        </p>
      </section>

      <section className="band settings-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">番茄节奏</p>
            <h2>番茄节奏</h2>
          </div>
          <AlarmClock size={20} />
        </div>
        <div className="settings-grid">
          <label>
            专注分钟
            <input type="number" min="5" max="90" value={settings.focusMinutes} onChange={(event) => updateSettings("focusMinutes", Number(event.target.value))} />
          </label>
          <label>
            短休分钟
            <input type="number" min="1" max="30" value={settings.shortBreakMinutes} onChange={(event) => updateSettings("shortBreakMinutes", Number(event.target.value))} />
          </label>
          <label>
            长休分钟
            <input type="number" min="5" max="60" value={settings.longBreakMinutes} onChange={(event) => updateSettings("longBreakMinutes", Number(event.target.value))} />
          </label>
          <label>
            长休间隔
            <input type="number" min="2" max="8" value={settings.longBreakEvery} onChange={(event) => updateSettings("longBreakEvery", Number(event.target.value))} />
          </label>
        </div>
        <div className="toggle-row">
          <label>
            <input type="checkbox" checked={settings.autoStartBreaks} onChange={(event) => updateSettings("autoStartBreaks", event.target.checked)} />
            自动开始休息
          </label>
        </div>
        <div className="notification-grid">
          <label className="inline-toggle">
            <input type="checkbox" checked={settings.notificationsEnabled} onChange={(event) => updateSettings("notificationsEnabled", event.target.checked)} />
            系统通知
          </label>
          <label className="inline-toggle">
            <input type="checkbox" checked={settings.soundEnabled} onChange={(event) => updateSettings("soundEnabled", event.target.checked)} />
            声音
          </label>
          <label>
            结束音效
            <select value={settings.timerEndSound} onChange={(event) => updateSettings("timerEndSound", event.target.value as Settings["timerEndSound"])}>
              <option value="soft">柔和</option>
              <option value="bell">铃声</option>
              <option value="digital">电子</option>
            </select>
          </label>
          <label>
            白噪音
            <select value={settings.whiteNoise} onChange={(event) => updateSettings("whiteNoise", event.target.value as Settings["whiteNoise"])}>
              <option value="off">关闭</option>
              <option value="rain">雨声</option>
              <option value="brown">棕噪音</option>
              <option value="cafe">咖啡馆</option>
            </select>
          </label>
          <label>
            音量
            <input type="range" min="0" max="100" value={settings.whiteNoiseVolume} onChange={(event) => updateSettings("whiteNoiseVolume", Number(event.target.value))} />
          </label>
          <button className="secondary-button" onClick={() => void askNotificationPermissions()}>
            <Bell size={16} />
            检查通知
          </button>
        </div>
        <p className="muted">通知权限：{settings.notificationSettings.permissionState}</p>
      </section>
    </>
  );
}
