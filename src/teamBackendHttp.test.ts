import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "./teamBackendHttp";

describe("requestJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts successful responses without a JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(requestJson<void>("http://127.0.0.1/tasks/task-1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("continues to decode successful JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));

    await expect(requestJson<{ ok: boolean }>("http://127.0.0.1/health")).resolves.toEqual({ ok: true });
  });
});
