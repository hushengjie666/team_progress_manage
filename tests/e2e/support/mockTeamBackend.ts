import type { Page } from "@playwright/test";
import type { AppState } from "../../../src/types";
import { releaseContract } from "../../../src/releaseContract";
import { MOCK_SERVER } from "./constants";
import { handleMockAuthRoute } from "./mockTeamBackendAuthRoutes";
import { handleMockInvitationRoute } from "./mockTeamBackendInvitationRoutes";
import { fulfillError } from "./mockTeamBackendResponses";
import { handleMockBusinessRoute } from "./mockTeamBackendBusinessRoutes";
import { createMockTeamBackendRuntime } from "./mockTeamBackendRuntime";
import { handleMockWorkspaceRoute } from "./mockTeamBackendWorkspaceRoutes";
import type { MockTeamBackendOptions } from "./mockTypes";

export const mockTeamBackend = async (page: Page, initialState: AppState, options: MockTeamBackendOptions = {}) => {
  const runtime = createMockTeamBackendRuntime(initialState, options);
  await page.route(`${MOCK_SERVER}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/health" && route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          service: "timemanage-team",
          release_version: releaseContract.releaseVersion,
          api_protocol_version: releaseContract.apiProtocolVersion,
          database_schema_version: releaseContract.databaseSchemaVersion,
          minimum_client_release: releaseContract.minimumClientRelease,
          ...runtime.options.health,
        }),
      });
      return;
    }
    if (await handleMockAuthRoute(route, url, runtime)) return;
    if (await handleMockInvitationRoute(route, url, runtime)) return;
    if (await handleMockWorkspaceRoute(route, url, runtime)) return;
    if (await handleMockBusinessRoute(route, url, runtime)) return;
    await fulfillError(route, 404, `unhandled mock route: ${url.pathname}`);
  });
};
