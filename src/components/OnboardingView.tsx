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
  const activeProfile = state.blockProfiles.find((profile) => profile.id === state.settings.activeBlockProfileId) ?? state.blockProfiles[0];
  const sourceList = sources
    .split(/[,\n，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const wasteDays = Math.round((waste * 365) / 60 / 24);
  const steps = ["分心来源", "浪费反思", "目标节奏"];

  const finish = () =>
    completeOnboarding({
      distractionSources: sourceList.length ? sourceList : ["社交消息"],
      desiredHabit: habit.trim() || `每天完成 ${dailyGoal} 个高质量番茄`,
      currentDailyWasteMinutes: waste,
      dailyGoalPomodoros: dailyGoal,
      preferredFocusMinutes: focusMinutes,
      strictModeIntent: state.onboarding.strictModeIntent,
      syncIntent: state.onboarding.syncIntent,
      blockedApps: activeProfile?.apps ?? [],
      blockedWebsites: activeProfile?.websites ?? [],
    });

  return (
    <main className="onboarding-shell">
      <section className="onboarding-stage">
        <div className="brand">
          <div className="brand-mark">
            <TimerReset size={24} />
          </div>
          <div>
            <strong>Team Progress</strong>
            <span>团队进度管控 · 个人偏好可稍后调整</span>
          </div>
        </div>
        <div className="onboarding-intro">
          <div>
            <p className="eyebrow">首次使用</p>
            <h1>先进入团队系统，个人节奏可以慢慢调。</h1>
            <p className="muted">下面只是个人节奏偏好，不影响项目、成员和任务管理。</p>
          </div>
          <button className="secondary-button" onClick={finish}>
            使用默认配置进入系统
          </button>
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
              保存偏好并进入系统
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
