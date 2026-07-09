import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { platform } from "node:os";

let backendUrl = process.env.TM_TAURI_SMOKE_BACKEND_URL ?? "http://127.0.0.1:8787";
const smokeEmail = process.env.TM_TAURI_SMOKE_EMAIL ?? "admin";
const smokePassword = process.env.TM_TAURI_SMOKE_PASSWORD ?? "hu626699";
const explicitBackendUrl = Boolean(process.env.TM_TAURI_SMOKE_BACKEND_URL);

let backendProcess;
let backendServer;

const run = async (command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: platform() === "win32",
    ...options,
    env: { ...process.env, ...options.env },
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${signal ?? code}`);
  }
};

const requestJson = async (path, init) => {
  const response = await fetch(new URL(path, backendUrl), init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
};

const healthAvailable = async () => {
  try {
    const response = await fetch(new URL("/health", backendUrl), { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
};

const authStatusAvailable = async () => {
  try {
    await requestJson("/auth/status");
    return true;
  } catch {
    return false;
  }
};

const waitForBackend = async () => {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (await healthAvailable()) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Local backend did not become healthy at ${backendUrl}`);
};

const readRequestBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const startMockBackend = async () => {
  backendUrl = "http://127.0.0.1:18787";
  if (await healthAvailable() && await authStatusAvailable()) {
    console.log(`[tauri-smoke] Reusing smoke backend at ${backendUrl}`);
    return;
  }
  if (await healthAvailable()) {
    throw new Error(`${backendUrl} is already occupied by a backend that cannot serve /auth/status`);
  }

  console.log(`[tauri-smoke] Starting mock smoke backend at ${backendUrl}`);
  const now = new Date().toISOString();
  const account = {
    id: "account_tauri_smoke",
    workspace_id: "workspace_tauri_smoke",
    name: "Tauri Smoke",
    email: smokeEmail,
    created_at: now,
    updated_at: now,
  };
  const workspace = {
    id: "workspace_tauri_smoke",
    name: "Tauri Smoke Workspace",
    type: "shared",
    owner_account_id: account.id,
    created_at: now,
    updated_at: now,
  };
  const membership = {
    id: "membership_tauri_smoke",
    workspace_id: workspace.id,
    account_id: account.id,
    name: account.name,
    email: account.email,
    role: "owner",
    status: "active",
    created_at: now,
    updated_at: now,
  };
  let rows = [];

  const loginPayload = {
    token: "tauri-smoke-token",
    user_id: account.id,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    account,
    workspace,
    membership,
    workspaces: [workspace],
  };

  backendServer = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", backendUrl);
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (request.method === "GET" && url.pathname === "/auth/status") {
        response.end(JSON.stringify({ bootstrapped: true, workspace_id: workspace.id, workspace_name: workspace.name }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/auth/login") {
        const body = await readRequestBody(request);
        if (String(body.email ?? body.username ?? "").trim() !== smokeEmail || body.password !== smokePassword) {
          response.writeHead(401);
          response.end(JSON.stringify({ error: "invalid email or password" }));
          return;
        }
        response.end(JSON.stringify(loginPayload));
        return;
      }
      if (request.method === "GET" && url.pathname === "/workspaces") {
        response.end(JSON.stringify({ workspaces: [workspace], memberships: [membership] }));
        return;
      }
      if (request.method === "GET" && url.pathname === "/team/data") {
        response.end(JSON.stringify({ rows }));
        return;
      }
      if (request.method === "PUT" && url.pathname === "/team/data") {
        const body = await readRequestBody(request);
        rows = Array.isArray(body.rows) ? body.rows : rows;
        response.end(JSON.stringify({ rows }));
        return;
      }
      if (request.method === "GET" && (url.pathname === "/workspace-invitations" || url.pathname === "/project-invitations")) {
        response.end(JSON.stringify({ invitations: [] }));
        return;
      }
      if (request.method === "GET" && url.pathname === "/admin/accounts") {
        response.end(JSON.stringify({ accounts: [account] }));
        return;
      }
      response.writeHead(404);
      response.end(JSON.stringify({ error: `mock route not found: ${request.method} ${url.pathname}` }));
    } catch (error) {
      response.writeHead(500);
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
  await new Promise((resolve, reject) => {
    backendServer.once("error", reject);
    backendServer.listen(18787, "127.0.0.1", resolve);
  });
};

const startBackendIfNeeded = async () => {
  if (await healthAvailable() && await authStatusAvailable()) {
    console.log(`[tauri-smoke] Reusing backend at ${backendUrl}`);
    return;
  }
  if (explicitBackendUrl) {
    throw new Error(`${backendUrl} is not a usable TimeManage auth backend for smoke testing`);
  }
  if (await healthAvailable()) {
    console.log(`[tauri-smoke] ${backendUrl} is occupied but /auth/status failed; using a mock smoke backend instead`);
    await startMockBackend();
    return;
  }

  await startMockBackend();
};

const ensureSmokeAccount = async () => {
  const status = await requestJson("/auth/status");
  const login = () => requestJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: smokeEmail,
      password: smokePassword,
      device_id: "tauri_smoke_device",
    }),
  });

  if (!status.bootstrapped) {
    console.log(`[tauri-smoke] Bootstrapping local workspace for ${smokeEmail}`);
    await requestJson("/auth/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_name: "Tauri Smoke Workspace",
        name: "Tauri Smoke",
        email: smokeEmail,
        password: smokePassword,
        device_id: "tauri_smoke_device",
      }),
    });
    return;
  }

  try {
    await login();
  } catch (error) {
    throw new Error(
      `Local backend is already bootstrapped, but smoke login failed for ${smokeEmail}. ` +
      "Set TM_TAURI_SMOKE_EMAIL and TM_TAURI_SMOKE_PASSWORD to an existing local account. " +
      `${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const cleanup = () => {
  if (backendProcess && !backendProcess.killed) backendProcess.kill("SIGTERM");
  if (backendServer) backendServer.close();
};

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  await startBackendIfNeeded();
  await ensureSmokeAccount();
  await run("npm", ["run", "build"], {
    env: { VITE_WDIO_TAURI: "1" },
  });
  await run("cargo", ["build", "--manifest-path", "src-tauri/Cargo.toml"]);
  await run("npx", ["wdio", "run", "tests/tauri/wdio.conf.mjs"], {
    env: {
      TM_TAURI_SMOKE_BACKEND_URL: backendUrl,
      TM_TAURI_SMOKE_EMAIL: smokeEmail,
      TM_TAURI_SMOKE_PASSWORD: smokePassword,
    },
  });
} finally {
  cleanup();
}
