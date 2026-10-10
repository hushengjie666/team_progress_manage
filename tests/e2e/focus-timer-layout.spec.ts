import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { openApp } from "./support/openApp";
import { startTimerInState } from "../../src/appModel";
import type { Task } from "../../src/types";
import { mockTeamBackend } from "./support/mockTeamBackend";

test.use({ viewport: { width: 1280, height: 820 } });

test("shows a recoverable page error instead of an empty window", async ({ page }) => {
  const state = authenticatedState();
  state.projects[0].name = { invalid: true } as unknown as string;
  await openApp(page, state);
  await expect(page.getByRole("heading", { name: "页面暂时无法显示" })).toBeVisible();
  await mockTeamBackend(page, authenticatedState());
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "页面导航", exact: true })).toBeVisible();
});

test("settles an expired focus timer without blanking the app when a task has no estimate history", async ({ page }) => {
  const initial = authenticatedState();
  initial.settings.notificationsEnabled = false;
  const state = startTimerInState(initial, "focus", initial.tasks[0].id,
    new Date(Date.now() - 26 * 60_000).toISOString(), "focus_missing_history",
    { workSessionId: "work_missing_history" });
  state.tasks[0] = { ...state.tasks[0], estimateHistory: null } as unknown as Task;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openApp(page, state);
  await expect(page.getByRole("navigation", { name: "页面导航", exact: true })).toBeVisible();
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await expect(page.locator(".timer-face")).toContainText("短休息");
  await expect(page.locator(".timer-countdown")).toHaveText("05:00");
  expect(errors).toEqual([]);
});

test("keeps the focus timer geometry stable while the countdown changes", async ({ page }, testInfo) => {
  const state = authenticatedState();
  const now = Date.now();
  state.tasks[0] = {
    ...state.tasks[0],
    status: "in_progress",
    actualPomodoros: 13,
    estimatePomodoros: 3,
  };
  state.activeTimer = {
    sessionId: "session_layout_stability",
    taskId: state.tasks[0].id,
    mode: "focus",
    duration: 600,
    remaining: 600,
    isRunning: true,
    startedAt: new Date(now).toISOString(),
    plannedEndAt: new Date(now + 10_000).toISOString(),
    totalPausedSeconds: 0,
    cycleIndex: 1,
    speedMultiplier: 60,
  };

  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();

  const orbit = page.locator(".focus-orbit");
  const face = page.locator(".timer-face");
  const countdown = page.locator(".timer-countdown");
  await expect(orbit).toBeVisible();
  await expect(face).toBeVisible();
  await expect(countdown).toBeVisible();

  const samples: Array<{
    orbit: { x: number; y: number; width: number; height: number };
    face: { x: number; y: number; width: number; height: number };
  }> = [];
  for (let index = 0; index < 12; index += 1) {
    const [orbitBounds, faceBounds] = await Promise.all([orbit.boundingBox(), face.boundingBox()]);
    expect(orbitBounds).not.toBeNull();
    expect(faceBounds).not.toBeNull();
    samples.push({ orbit: orbitBounds!, face: faceBounds! });
    await page.waitForTimeout(120);
  }

  const roundBounds = (bounds: { x: number; y: number; width: number; height: number }) => ({
    x: Math.round(bounds.x * 100) / 100,
    y: Math.round(bounds.y * 100) / 100,
    width: Math.round(bounds.width * 100) / 100,
    height: Math.round(bounds.height * 100) / 100,
  });
  const normalizedBounds = samples.map(({ orbit: orbitBounds, face: faceBounds }) => ({
    orbit: roundBounds(orbitBounds),
    face: roundBounds(faceBounds),
  }));
  expect(new Set(normalizedBounds.map((bounds) => JSON.stringify(bounds))).size).toBe(1);
  const stableOrbit = normalizedBounds[0].orbit;
  const stableFace = normalizedBounds[0].face;
  expect(stableOrbit.width).toBe(stableOrbit.height);
  expect(stableFace.width).toBe(stableFace.height);
  expect(stableFace.width).toBe(stableOrbit.width - 20);
  expect(stableFace.x + stableFace.width / 2).toBe(stableOrbit.x + stableOrbit.width / 2);
  expect(stableFace.y + stableFace.height / 2).toBe(stableOrbit.y + stableOrbit.height / 2);

  const countdownLayout = await countdown.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const faceBounds = element.closest(".timer-face")!.getBoundingClientRect();
    return {
      leftInset: bounds.left - faceBounds.left,
      rightInset: faceBounds.right - bounds.right,
      centerOffset: (bounds.left + bounds.width / 2) - (faceBounds.left + faceBounds.width / 2),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(countdownLayout.leftInset).toBeGreaterThanOrEqual(30);
  expect(countdownLayout.rightInset).toBeGreaterThanOrEqual(30);
  expect(countdownLayout.leftInset).toBeCloseTo(countdownLayout.rightInset, 1);
  expect(countdownLayout.centerOffset).toBeCloseTo(0, 1);
  expect(countdownLayout.scrollWidth).toBeLessThanOrEqual(countdownLayout.clientWidth);

  await expect(countdown).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(orbit.locator(".focus-orbit-progress")).toHaveCount(1);
  await testInfo.attach("focus-timer-layout", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("keeps a short break running after the team data refresh interval", async ({ page }) => {
  await openApp(page);
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();
  await page.locator(".mode-switcher").getByRole("button", { name: "短休息" }).click();

  const timerFace = page.locator(".timer-face");
  const countdown = timerFace.locator(".timer-countdown");
  await expect(timerFace).toContainText("短休息");
  await expect(countdown).toHaveText(/04:5\d/);

  await page.waitForTimeout(6_000);

  await expect(timerFace).toContainText("短休息");
  await expect(countdown).toHaveText(/04:[45]\d/);
  await expect(countdown).not.toHaveText("25:00");
});

test("prepares the next stage at full duration and waits for the user to start", async ({ page }) => {
  const initial = authenticatedState();
  initial.settings = {
    ...initial.settings,
    focusMinutes: 1,
    devTimerSpeed100xEnabled: true,
  };
  const timestamp = new Date().toISOString();
  const state = startTimerInState(
    initial,
    "focus",
    initial.tasks[0].id,
    timestamp,
    "session_natural_finish",
    { workSessionId: "work_natural_finish" },
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const observed = { contexts: 0, oscillators: 0, peak: 0 };
    Object.assign(window, { timerAudioObserved: observed });
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor() {
        super();
        observed.contexts += 1;
      }
      createOscillator() {
        observed.oscillators += 1;
        return super.createOscillator();
      }
      createGain() {
        const gain = super.createGain();
        const connect = gain.connect.bind(gain);
        gain.connect = ((destination: AudioNode) => {
          if (destination !== this.destination) return connect(destination);
          const analyser = this.createAnalyser();
          analyser.connect(destination);
          const samples = new Float32Array(analyser.fftSize);
          const handle = setInterval(() => {
            analyser.getFloatTimeDomainData(samples);
            observed.peak = Math.max(observed.peak, ...samples.map(Math.abs));
          }, 25);
          setTimeout(() => clearInterval(handle), 5000);
          return connect(analyser);
        }) as typeof gain.connect;
        return gain;
      }
    };
  });
  await openApp(page, state);
  await page.getByLabel("页面导航").getByRole("button", { name: "开始工作" }).click();

  const timerFace = page.locator(".timer-face");
  const countdown = timerFace.locator(".timer-countdown");
  const startButton = page.locator(".timer-controls").getByRole("button", { name: "开始" });
  await expect(timerFace).toContainText("短休息", { timeout: 5_000 });
  await expect(countdown).toHaveText("05:00");
  await expect(startButton).toBeVisible();
  const audioResult = () => page.evaluate(() =>
    (window as unknown as { timerAudioObserved: { contexts: number; oscillators: number; peak: number } }).timerAudioObserved);
  await expect.poll(async () => (await audioResult()).peak).toBeGreaterThan(0.001);
  expect(await audioResult()).toMatchObject({ contexts: 1, oscillators: state.settings.timerEndSoundRepeats });
  expect(errors).toEqual([]);

  await page.waitForTimeout(1_200);
  await expect(countdown).toHaveText("05:00");

  await startButton.click();
  await expect(page.locator(".timer-controls").getByRole("button", { name: "暂停" })).toBeVisible();
  await expect(countdown).not.toHaveText("05:00", { timeout: 2_500 });
});
