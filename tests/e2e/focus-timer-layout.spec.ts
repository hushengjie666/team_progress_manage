import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { openApp } from "./support/openApp";

test("keeps the focus timer geometry stable while the countdown changes", async ({ page }) => {
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
  const countdown = page.locator(".timer-countdown");
  await expect(orbit).toBeVisible();
  await expect(countdown).toBeVisible();

  const samples: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let index = 0; index < 12; index += 1) {
    const bounds = await orbit.boundingBox();
    expect(bounds).not.toBeNull();
    samples.push(bounds!);
    await page.waitForTimeout(120);
  }

  const normalizedBounds = samples.map((bounds) => ({
    x: Math.round(bounds.x * 100) / 100,
    y: Math.round(bounds.y * 100) / 100,
    width: Math.round(bounds.width * 100) / 100,
    height: Math.round(bounds.height * 100) / 100,
  }));
  expect(new Set(normalizedBounds.map((bounds) => JSON.stringify(bounds))).size).toBe(1);
  expect(normalizedBounds[0].width).toBe(normalizedBounds[0].height);

  await expect(countdown).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(orbit.locator(".focus-orbit-progress")).toHaveCount(1);
});
