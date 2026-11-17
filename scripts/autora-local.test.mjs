import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { test } from "node:test";
import { autoraLocalMiddleware, autoraLocalPlugin } from "./autora-local.mjs";

const token = "test-only-autora-token";
async function withBridge(fn, env = { AUTORA_ADMIN_TOKEN: token }) {
  const calls = [];
  const middleware = autoraLocalMiddleware(env, async (url, options) => {
    calls.push({ url, ...options });
    return new Response(JSON.stringify({ ok: true, redacted: token }), { status: 202 });
  });
  const server = createServer((req, res) => { void middleware(req, res, () => { res.writeHead(404); res.end(); }); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const send = (path, options = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path, ...options }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on("error", reject);
    req.end(options.body);
  });
  try { await fn({ send, calls, origin: `http://127.0.0.1:${port}` }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("local bridge keeps credentials on the server and preserves idempotency", async () => {
  await withBridge(async ({ send, calls, origin }) => {
    const result = await send("/__autora/api/v1/requirements", {
      method: "POST", body: JSON.stringify({ title: "需求" }),
      headers: { origin, "content-type": "application/json", "idempotency-key": "message-1", authorization: "Bearer browser-value" },
    });
    assert.equal(result.status, 202);
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(calls[0].url, "http://127.0.0.1:8890/api/v1/requirements");
    assert.equal(calls[0].headers.Authorization, `Bearer ${token}`);
    assert.equal(calls[0].headers["Idempotency-Key"], "message-1");
    assert.equal(calls[0].headers.Origin, undefined);
    assert.equal(result.body.includes(token), false);
  });
});

test("local bridge rejects foreign origins, DNS rebinding and browser cross-site requests", async () => {
  await withBridge(async ({ send, calls }) => {
    for (const headers of [{ origin: "https://example.com" }, { host: "evil.example" }, { "sec-fetch-site": "cross-site" }]) {
      assert.equal((await send("/__autora/api/v1/status", { headers })).status, 403);
    }
    assert.equal(calls.length, 0);
  });
});

test("local bridge exposes only analysis resources, never path binding or arbitrary upstream routes", async () => {
  await withBridge(async ({ send, calls }) => {
    for (const [path, method] of [
      ["/bindings/inspect", "POST"], ["/bindings", "POST"], ["/bindings/id", "PATCH"],
      ["/status?secret=value", "GET"], ["/conversations", "GET"], ["/other", "GET"],
    ]) assert.equal((await send(`/__autora/api/v1${path}`, { method })).status, 404);
    assert.equal(calls.length, 0);
  });
});

test("local bridge requires JSON, a stable idempotency key and bounded bodies", async () => {
  await withBridge(async ({ send, calls }) => {
    assert.equal((await send("/__autora/api/v1/requirements", { method: "POST", body: "{}" })).status, 400);
    const result = await send("/__autora/api/v1/requirements", {
      method: "POST", body: "x".repeat(256 * 1024 + 1),
      headers: { "content-type": "application/json", "idempotency-key": "large-body" },
    });
    assert.equal(result.status, 413);
    assert.equal(calls.length, 0);
  });
});

test("local bridge reports missing configuration and rejects nonlocal destinations", async () => {
  await withBridge(async ({ send }) => {
    assert.equal((await send("/__autora/api/v1/status")).status, 503);
  }, {});
  await withBridge(async ({ send, calls }) => {
    const result = await send("/__autora/api/v1/status");
    assert.equal(JSON.parse(result.body).error.code, "autora_invalid_config");
    assert.equal(calls.length, 0);
  }, { AUTORA_ADMIN_TOKEN: token, AUTORA_LOCAL_URL: "https://example.com" });
  assert.equal(autoraLocalPlugin({}).apply, "serve");
});
