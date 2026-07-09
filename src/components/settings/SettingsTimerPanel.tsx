import { useEffect, useRef, useState } from "react";
import { AlarmClock, Bell, Minus, Plus, Sparkles, Volume2, VolumeX } from "lucide-react";
import { normalizeTimerSoundRepeats, normalizeTimerSoundVolume, playTimerSound, startWhiteNoise } from "../../notifications";
import type { Settings } from "../../types";

function VolumeStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const commit = (nextValue: number) => onChange(normalizeTimerSoundVolume(nextValue));

  return (
    <div className="volume-stepper-field">
      <span>{label}</span>
      <div className="volume-stepper" role="group" aria-label={label}>
        <button type="button" className="icon-button small" title="降低音量" onClick={() => commit(value - 10)}>
          <Minus size={14} />
        </button>
        <input
          type="number"
          min="0"
          max="100"
          step="5"
          value={value}
          aria-label={label}
          onChange={(event) => commit(Number(event.target.value))}
        />
        <button type="button" className="icon-button small" title="提高音量" onClick={() => commit(value + 10)}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

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
  const stopWhiteNoisePreviewRef = useRef<(() => void) | null>(null);
  const [whiteNoisePreviewing, setWhiteNoisePreviewing] = useState(false);

  const stopWhiteNoisePreview = () => {
    stopWhiteNoisePreviewRef.current?.();
    stopWhiteNoisePreviewRef.current = null;
    setWhiteNoisePreviewing(false);
  };

  const startWhiteNoisePreview = () => {
    stopWhiteNoisePreviewRef.current?.();
    stopWhiteNoisePreviewRef.current = startWhiteNoise(settings.whiteNoise, settings.whiteNoiseVolume);
    setWhiteNoisePreviewing(true);
  };

  const toggleWhiteNoisePreview = () => {
    if (whiteNoisePreviewing) {
      stopWhiteNoisePreview();
      return;
    }
    startWhiteNoisePreview();
  };

  useEffect(() => () => stopWhiteNoisePreview(), []);

  useEffect(() => {
    if (!whiteNoisePreviewing) return;
    if (settings.whiteNoise === "off" || settings.whiteNoiseVolume <= 0) {
      stopWhiteNoisePreview();
      return;
    }
    startWhiteNoisePreview();
  }, [settings.whiteNoise, settings.whiteNoiseVolume]);

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
          <VolumeStepper
            label="结束音量"
            value={settings.timerEndSoundVolume}
            onChange={(value) => updateSettings("timerEndSoundVolume", value)}
          />
          <label>
            音效次数
            <input
              type="number"
              min="1"
              max="5"
              value={settings.timerEndSoundRepeats}
              onChange={(event) => updateSettings("timerEndSoundRepeats", normalizeTimerSoundRepeats(Number(event.target.value)))}
            />
          </label>
          <button
            className="secondary-button"
            type="button"
            title="试听结束音效"
            onClick={() => playTimerSound({
              soundEnabled: true,
              timerEndSound: settings.timerEndSound,
              timerEndSoundVolume: settings.timerEndSoundVolume,
              timerEndSoundRepeats: settings.timerEndSoundRepeats,
            })}
          >
            <Volume2 size={16} />
            试听
          </button>
          <label>
            白噪音
            <select value={settings.whiteNoise} onChange={(event) => updateSettings("whiteNoise", event.target.value as Settings["whiteNoise"])}>
              <option value="off">关闭</option>
              <option value="rain">雨声</option>
              <option value="brown">棕噪音</option>
              <option value="cafe">咖啡馆</option>
            </select>
          </label>
          <VolumeStepper
            label="白噪音音量"
            value={settings.whiteNoiseVolume}
            onChange={(value) => updateSettings("whiteNoiseVolume", value)}
          />
          <button
            className="secondary-button"
            type="button"
            disabled={settings.whiteNoise === "off" || settings.whiteNoiseVolume <= 0}
            title={whiteNoisePreviewing ? "停止白噪音" : "试听白噪音"}
            onClick={toggleWhiteNoisePreview}
          >
            {whiteNoisePreviewing ? <VolumeX size={16} /> : <Volume2 size={16} />}
            {whiteNoisePreviewing ? "停止白噪音" : "试听白噪音"}
          </button>
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
