import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "./teamBackendHttp";

describe("requestJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("accepts successful responses without a JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(requestJson<void>("http://127.0.0.1/tasks/task-1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("continues to decode successful JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));

    await expect(requestJson<{ ok: boolean }>("http://127.0.0.1/health")).resolves.toEqual({ ok: true });
  });

  it("distinguishes a request timeout from a connection failure", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const result = requestJson("http://127.0.0.1/health");
    const assertion = expect(result).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
  });

  it("keeps the timeout active until the response body finishes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_input, init) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    })));
    const assertion = expect(requestJson("http://127.0.0.1/health")).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
  });

  it("does not retry writes without an idempotency key", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("connection lost"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson("http://127.0.0.1/tasks", { method: "POST" }, { retry: true })).rejects.toMatchObject({ kind: "network" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not retry permission failures even with an idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "denied" }, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson("http://127.0.0.1/tasks", { method: "POST", headers: { "Idempotency-Key": "test_write" } }, { retry: true })).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
