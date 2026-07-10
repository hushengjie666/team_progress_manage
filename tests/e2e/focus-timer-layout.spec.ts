import { expect, test } from "@playwright/test";
import { authenticatedState } from "./support/authenticatedState";
import { openApp } from "./support/openApp";

test.use({ viewport: { width: 1280, height: 820 } });

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
