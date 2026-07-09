import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const repoRoot = resolve(import.meta.dirname, "..");
const backendConfigPath = resolve(repoRoot, "team-server", "backend.local.json");
const goPathPrefix = "/Volumes/MacSSD/env/Go/bin";
const pathWithGo = existsSync(goPathPrefix) ? `${goPathPrefix}:${process.env.PATH ?? ""}` : process.env.PATH;
const runId = `autotest_${Date.now().toString(36)}`;
const adminEmail = process.env.TM_TAURI_FUNCTIONAL_ADMIN_EMAIL ?? "admin";
const adminPassword = process.env.TM_TAURI_FUNCTIONAL_ADMIN_PASSWORD ?? "hu626699";
const ownerEmail = `${runId}_owner@example.com`;
const memberEmail = `${runId}_member@example.com`;
const projectInviteeEmail = `${runId}_project@example.com`;
const testPassword = process.env.TM_TAURI_FUNCTIONAL_PASSWORD ?? "hu626699";

let backendProcess;
let tempDir;
let tempHomeDir;
let tempDbDsn;

const tauriAppBinaryPath = () => {
  if (process.platform === "darwin") {
    return resolve(
      repoRoot,
      "src-tauri",
      "target",
      "debug",
      "bundle",
      "macos",
      "TimeManage.app",
      "Contents",
      "MacOS",
      "timemanage-desktop",
    );
  }
  return resolve(
    repoRoot,
    "src-tauri",
    "target",
    "debug",
    process.platform === "win32" ? "timemanage-desktop.exe" : "timemanage-desktop",
  );
};

const run = async (command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
    env: { ...process.env, PATH: pathWithGo, ...options.env },
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${signal ?? code}`);
  }
};

const requestJson = async (baseUrl, path, init = {}) => {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (response.ok) return response.json();
  let detail = `${response.status} ${response.statusText}`;
  try {
    const payload = await response.json();
    detail = payload.error ?? detail;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) detail = text;
  }
  throw new Error(`${init.method ?? "GET"} ${path} failed: ${detail}`);
};

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const freePort = async () => {
  const server = createServer();
  await new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  const port = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
};

const dsnFromLocalConfig = () => {
  if (!existsSync(backendConfigPath)) return "";
  try {
    return JSON.parse(readFileSync(backendConfigPath, "utf8")).mysql_dsn ?? "";
  } catch {
    return "";
  }
};

const baseMysqlDsn = () => {
  const dsn = process.env.TM_BACKEND_TEST_MYSQL_DSN || process.env.TM_BACKEND_MYSQL_DSN || dsnFromLocalConfig();
  if (!dsn) {
    throw new Error(
      "A real MySQL DSN is required. Set TM_BACKEND_TEST_MYSQL_DSN or configure team-server/backend.local.json mysql_dsn.",
    );
  }
  return dsn;
};

const deriveTempDsn = (dsn) => {
  const match = dsn.match(/\/([^/?]+)(\?[^?]*)?$/);
  if (!match) throw new Error("MySQL DSN must include a database name.");
  const dbName = `tm_tauri_functional_${Date.now().toString(36)}`;
  return {
    dsn: `${dsn.slice(0, match.index + 1)}${dbName}${match[2] ?? ""}`,
    dbName,
  };
};

const waitForBackend = async (baseUrl) => {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    try {
      const response = await fetch(new URL("/health", baseUrl), { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // Retry until startup deadline.
    }
    await new Promise((resolveReady) => setTimeout(resolveReady, 300));
  }
  throw new Error(`Backend did not become healthy at ${baseUrl}`);
};

const startBackend = async () => {
  const port = await freePort();
  const backendUrl = `http://127.0.0.1:${port}`;
  const { dsn, dbName } = deriveTempDsn(baseMysqlDsn());
  tempDbDsn = dsn;
  tempDir = mkdtempSync(join(tmpdir(), "timemanage-tauri-functional-"));
  const configPath = join(tempDir, "backend.json");
  writeFileSync(configPath, `${JSON.stringify({
    addr: `127.0.0.1:${port}`,
    mysql_dsn: dsn,
    username: adminEmail,
    password: adminPassword,
    secret: `functional-secret-${runId}`,
  }, null, 2)}\n`);

  console.log(`[tauri-functional] Starting real backend at ${backendUrl} with isolated database ${dbName}`);
  backendProcess = spawn(resolve(repoRoot, "team-server", "bin", process.platform === "win32" ? "timemanage-team.exe" : "timemanage-team"), [
    "serve",
    "--config",
    configPath,
  ], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, PATH: pathWithGo },
  });
  backendProcess.once("exit", (code, signal) => {
    if (code !== null && code !== 0) console.error(`[tauri-functional] backend exited with ${signal ?? code}`);
  });
  await waitForBackend(backendUrl);
  return backendUrl;
};

const createIsolatedTauriHome = () => {
  tempHomeDir = mkdtempSync(join(tmpdir(), "timemanage-tauri-home-"));
  console.log(`[tauri-functional] Using isolated Tauri HOME ${tempHomeDir}`);
  return tempHomeDir;
};

const ensureAccount = async (backendUrl, token, { name, email, password }) => {
  await requestJson(backendUrl, "/admin/accounts", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      email,
      password,
      status: "active",
    }),
  });
};

const prepareAccounts = async (backendUrl) => {
  await requestJson(backendUrl, "/auth/status");
  const login = await requestJson(backendUrl, "/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      device_id: `${runId}_admin_device`,
    }),
  });
  const token = login.token;
  await ensureAccount(backendUrl, token, { name: "自动化负责人", email: ownerEmail, password: testPassword });
  await ensureAccount(backendUrl, token, { name: "自动化成员", email: memberEmail, password: testPassword });
  await ensureAccount(backendUrl, token, { name: "自动化项目受邀人", email: projectInviteeEmail, password: testPassword });
  console.log(`[tauri-functional] Prepared accounts for ${runId}`);
};

const dropTempDatabase = () => {
  if (!tempDbDsn) return;
  const dropDir = mkdtempSync(join(tmpdir(), "timemanage-drop-db-"));
  const dropProgram = join(dropDir, "drop.go");
  writeFileSync(dropProgram, `package main

import (
  "context"
  "database/sql"
  "fmt"
  "os"
  "time"

  "github.com/go-sql-driver/mysql"
)

func escapeIdentifier(value string) string {
  escaped := ""
  for _, char := range value {
    if char == rune(96) {
      escaped += string(rune(96)) + string(rune(96))
    } else {
      escaped += string(char)
    }
  }
  return escaped
}

func quoteIdentifier(value string) string {
  return string(rune(96)) + escapeIdentifier(value) + string(rune(96))
}

func main() {
  if len(os.Args) != 2 {
    panic("usage: drop.go <dsn>")
  }
  cfg, err := mysql.ParseDSN(os.Args[1])
  if err != nil {
    panic(err)
  }
  dbName := cfg.DBName
  if dbName == "" {
    return
  }
  cfg.DBName = ""
  db, err := sql.Open("mysql", cfg.FormatDSN())
  if err != nil {
    panic(err)
  }
  defer db.Close()
  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()
  if _, err := db.ExecContext(ctx, fmt.Sprintf("DROP DATABASE IF EXISTS %s", quoteIdentifier(dbName))); err != nil {
    panic(err)
  }
}
`);
  const result = spawnSync("go", ["run", dropProgram, tempDbDsn], {
    cwd: resolve(repoRoot, "team-server"),
    encoding: "utf8",
    env: { ...process.env, PATH: pathWithGo },
  });
  rmSync(dropDir, { recursive: true, force: true });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "[tauri-functional] failed to drop temp database");
  }
};

const cleanup = () => {
  if (backendProcess && !backendProcess.killed) backendProcess.kill("SIGTERM");
  dropTempDatabase();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  if (tempHomeDir) rmSync(tempHomeDir, { recursive: true, force: true });
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
  await run("npm", ["run", "backend:build"]);
  const backendUrl = await startBackend();
  await prepareAccounts(backendUrl);
  await run("cargo", ["clean", "--manifest-path", "src-tauri/Cargo.toml", "-p", "timemanage-desktop"]);
  await run("npx", ["tauri", "build", "--debug", "--bundles", "app", "--ci", "--no-sign"], {
    env: {
      VITE_WDIO_TAURI: "1",
      VITE_TM_TAURI_FUNCTIONAL_BACKEND_URL: backendUrl,
    },
  });
  const tauriHome = createIsolatedTauriHome();
  await run("npx", ["wdio", "run", "tests/tauri/wdio.conf.mjs"], {
    env: {
      TM_TAURI_APP_BINARY: tauriAppBinaryPath(),
      TM_TAURI_WDIO_SPEC: resolve(repoRoot, "tests", "tauri", "functional-real.e2e.mjs"),
      TM_TAURI_TEST_HOME: tauriHome,
      TM_TAURI_FUNCTIONAL_BACKEND_URL: backendUrl,
      TM_TAURI_FUNCTIONAL_RUN_ID: runId,
      TM_TAURI_FUNCTIONAL_OWNER_EMAIL: ownerEmail,
      TM_TAURI_FUNCTIONAL_MEMBER_EMAIL: memberEmail,
      TM_TAURI_FUNCTIONAL_PROJECT_INVITEE_EMAIL: projectInviteeEmail,
      TM_TAURI_FUNCTIONAL_PASSWORD: testPassword,
    },
  });
} finally {
  cleanup();
}
