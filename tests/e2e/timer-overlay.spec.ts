import { expect, test } from "@playwright/test";

test("keeps the desktop timer overlay canvas transparent", async ({ page }) => {
  await page.goto("/?window=timer-overlay");

  await expect(page.locator("html")).toHaveClass(/timer-overlay-document/);
  await expect(page.locator("body")).toHaveClass(/timer-overlay-body/);

  const backgrounds = await page.evaluate(() => {
    const root = document.querySelector("#root");
    const overlay = document.querySelector(".timer-overlay-root");
    return {
      document: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      root: root ? getComputedStyle(root).backgroundColor : "missing",
      overlay: overlay ? getComputedStyle(overlay).backgroundColor : "missing",
    };
  });

  expect(backgrounds).toEqual({
    document: "rgba(0, 0, 0, 0)",
    body: "rgba(0, 0, 0, 0)",
    root: "rgba(0, 0, 0, 0)",
    overlay: "rgba(0, 0, 0, 0)",
  });
});
