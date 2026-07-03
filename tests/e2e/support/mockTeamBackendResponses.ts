import type { Route } from "@playwright/test";

export const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

export const fulfillError = (route: Route, status: number, error: string) =>
  fulfillJson(route, { error }, status);
