import { expect, test } from "@playwright/test";
import { clearStoredApp, openApp } from "./support/openApp";
import { authenticatedState } from "./support/authenticatedState";

test.beforeEach(async ({ page }) => {
  await clearStoredApp(page);
});

test("blocks the business shell when the backend does not publish the release contract", async ({ page }) => {
  const businessRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/(app\/bootstrap|projects|tasks|daily-plans|work-sessions)\b/.test(request.url())) businessRequests.push(request.url());
  });

  await openApp(page, authenticatedState(), { health: { release_version: undefined, api_protocol_version: undefined, database_schema_version: undefined, minimum_client_release: undefined } });

  await expect(page.getByRole("heading", { name: "需要同时升级客户端和后台" })).toBeVisible();
  await expect(page.locator(".compatibility-details div").filter({ hasText: "后台版本" })).toContainText("未提供");
  expect(businessRequests).toEqual([]);
});
