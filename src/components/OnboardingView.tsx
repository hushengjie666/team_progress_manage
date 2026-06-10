import { TimerReset } from "lucide-react";
import { useState } from "react";
import type { AppState } from "../types";

export function OnboardingView(props: {
  state: AppState;
  completeOnboarding: (payload: {
    distractionSources: string[];
    desiredHabit: string;
    currentDailyWasteMinutes: number;
    dailyGoalPomodoros: number;
    preferredFocusMinutes: number;
    strictModeIntent: AppState["onboarding"]["strictModeIntent"];
    syncIntent: AppState["onboarding"]["syncIntent"];
    blockedApps: string[];
    blockedWebsites: string[];
  }) => void;
}) {
  const { state, completeOnboarding } = props;
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState(state.onboarding.distractionSources.join("，"));
  const [habit, setHabit] = useState(state.onboarding.desiredHabit);
  const [waste, setWaste] = useState(state.onboarding.currentDailyWasteMinutes);
  const [dailyGoal, setDailyGoal] = useState(state.onboarding.dailyGoalPomodoros);
  const [focusMinutes, setFocusMinutes] = useState(state.onboarding.preferredFocusMinutes);
  const [strictIntent, setStrictIntent] = useState<AppState["onboarding"]["strictModeIntent"]>(state.onboarding.strictModeIntent);
  const [syncIntent, setSyncIntent] = useState<AppState["onboarding"]["syncIntent"]>(state.onboarding.syncIntent);
  const activeProfile = state.blockProfiles.find((profile) => profile.id === state.settings.activeBlockProfileId) ?? state.blockProfiles[0];
  const [apps, setApps] = useState(activeProfile?.apps.join("\n") ?? "");
  const [websites, setWebsites] = useState(activeProfile?.websites.join("\n") ?? "");
  const sourceList = sources
    .split(/[,\n，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const wasteDays = Math.round((waste * 365) / 60 / 24);
  const steps = ["分心来源", "浪费反思", "目标节奏", "严格与同步"];

  const finish = () =>
    completeOnboarding({
      distractionSources: sourceList.length ? sourceList : ["社交消息"],
      desiredHabit: habit.trim() || `每天完成 ${dailyGoal} 个高质量番茄`,
      currentDailyWasteMinutes: waste,
      dailyGoalPomodoros: dailyGoal,
      preferredFocusMinutes: focusMinutes,
      strictModeIntent: strictIntent,
      syncIntent,
      blockedApps: apps
        .split(/[,\n，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      blockedWebsites: websites
        .split(/[,\n，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    });

  return (
    <main className="onboarding-shell">
      <section className="onboarding-stage">
        <div className="brand">
          <div className="brand-mark">
            <TimerReset size={24} />
          </div>
          <div>
            <strong>TimeManage</strong>
            <span>自律番茄系统</span>
          </div>
        </div>
        <div className="stepper">
          {steps.map((label, index) => (
            <button className={index === step ? "active" : ""} key={label} onClick={() => setStep(index)}>
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="onboarding-card">
            <p className="eyebrow">Distraction</p>
            <h1>先把分心源摆到桌面上。</h1>
            <label>
              常见分心来源
              <textarea value={sources} onChange={(event) => setSources(event.target.value)} />
            </label>
            <div className="chip-row">
              {sourceList.map((source) => (
                <span className="chip filled" key={source}>{source}</span>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-card">
            <p className="eyebrow">Reflection</p>
            <h1>浪费时间不是道德问题，是需要被设计的问题。</h1>
            <label>
              每天大约被分心吃掉几分钟
              <input type="number" min="0" max="600" value={waste} onChange={(event) => setWaste(Number(event.target.value))} />
            </label>
            <p className="muted">按这个速度，一年大约会流失 {wasteDays} 天。</p>
            <label>
              你想建立的习惯
              <textarea value={habit} onChange={(event) => setHabit(event.target.value)} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-card">
            <p className="eyebrow">Commitment</p>
            <h1>默认少承诺一点，兑现多一点。</h1>
            <div className="settings-grid">
              <label>
                每日目标番茄
                <input type="number" min="1" max="16" value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))} />
              </label>
              <label>
                专注分钟
                <input type="number" min="5" max="90" value={focusMinutes} onChange={(event) => setFocusMinutes(Number(event.target.value))} />
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-card">
            <p className="eyebrow">Strict Mode</p>
            <h1>给分心设置一点摩擦。</h1>
            <div className="settings-grid">
              <label>
                严格模式强度
                <select value={strictIntent} onChange={(event) => setStrictIntent(event.target.value as AppState["onboarding"]["strictModeIntent"])}>
                  <option value="soft">软记录</option>
                  <option value="balanced">违规暂停</option>
                  <option value="locked">连续违规作废</option>
                </select>
              </label>
              <label>
                同步偏好
                <select value={syncIntent} onChange={(event) => setSyncIntent(event.target.value as AppState["onboarding"]["syncIntent"])}>
                  <option value="local">先本地使用</option>
                  <option value="self_hosted">连接自建同步服务</option>
                </select>
              </label>
            </div>
            <label>
              屏蔽 App
              <textarea value={apps} onChange={(event) => setApps(event.target.value)} />
            </label>
            <label>
              屏蔽网站
              <textarea value={websites} onChange={(event) => setWebsites(event.target.value)} />
            </label>
          </div>
        )}

        <div className="onboarding-actions">
          <button className="secondary-button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
            上一步
          </button>
          {step < steps.length - 1 ? (
            <button className="primary-button" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>
              下一步
            </button>
          ) : (
            <button className="primary-button" onClick={finish}>
              开始今天
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

