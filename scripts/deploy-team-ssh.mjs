import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectPackageFiles, encodedPowerShell, hashFile, psQuote, sftpQuote, validateConnection } from "./windows-ssh-common.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const run = (command, argv, options = {}) => {
  const result = spawnSync(command, argv, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
};
if (args.includes("--help")) {
  console.log("Usage: npm run server:deploy -- [--package <unified-package-directory> | --build] [--dry-run]\nConnection: npm run server:ssh:check\nOptional: --config <json> --host-keys <server-host-keys.txt>");
  process.exit(0);
}

let scratch;
try {
  const config = validateConnection(JSON.parse(readFileSync(value("--config", join(homedir(), ".config", "timemanage-deploy", "config.json")), "utf8")));
  if (!existsSync(config.keyFile)) throw new Error("SSH private key is missing. Run server:ssh:prepare first.");
  const sshOptions = ["-i", config.keyFile, "-o", "IdentitiesOnly=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", `StrictHostKeyChecking=${args.includes("--check") && !value("--host-keys") ? "ask" : "yes"}`];
  if (value("--host-keys")) {
    const knownHosts = join(dirname(config.keyFile), "timemanage_known_hosts");
    const lines = readFileSync(value("--host-keys"), "utf8").trim().split(/\r?\n/).map((line) => {
      const [host, algorithm, key] = line.trim().split(/\s+/);
      if (host !== config.host || !/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-[\w-]+)$/.test(algorithm ?? "") || !/^[A-Za-z0-9+/]+=*$/.test(key ?? "")) throw new Error("Invalid server host key file.");
      return `${config.port === 22 ? config.host : `[${config.host}]:${config.port}`} ${algorithm} ${key}`;
    });
    if (!args.includes("--dry-run")) writeFileSync(knownHosts, lines.join("\n") + "\n", { mode: 0o600 });
    sshOptions.push("-o", `UserKnownHostsFile=${knownHosts}`);
  }
  const target = `${config.user}@${config.host}`;
  const remote = (source, interactive = false) => run("ssh", [...sshOptions, "-o", `BatchMode=${interactive ? "no" : "yes"}`, "-p", String(config.port), "-T", target,
    `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encodedPowerShell(source)}`]);
  if (args.includes("--check")) {
    remote('$ErrorActionPreference="Stop"; Write-Output ("SSH READY: " + [Environment]::MachineName + " / " + [Environment]::UserName + " / PowerShell " + $PSVersionTable.PSVersion)', true);
    process.exit(0);
  }
  if (args.includes("--build")) {
    if (args.includes("--dry-run")) throw new Error("--dry-run cannot build; select an existing package.");
    run("npm", ["run", "deploy:team"], { cwd: root });
  }
  const latest = () => readdirSync(join(root, "deploy")).filter((name) => /^timemanageTeam-v\d+\.\d+\.\d+-\d{8}-\d{6}$/.test(name)).sort((a, b) => b.slice(-15).localeCompare(a.slice(-15)))[0];
  const packageDir = value("--package") ?? join(root, "deploy", latest() ?? "NO_PACKAGE");
  const payload = collectPackageFiles(packageDir);
  const uploadName = `timemanage-upload-${Date.now()}`;
  const uploadRoot = `${config.remoteRoot.replaceAll("\\", "/")}/${uploadName}`;
  console.log(`Release ${payload.contract.release_version}: ${payload.files.length} files\nTarget: ${target}:${config.port}\nRuntime: ${config.remoteRoot}\\timemanageTeam\nPackage: ${payload.root}`);
  if (args.includes("--dry-run")) {
    console.log("Plan: check SSH -> upload and verify -> stage files -> stop backend -> verified database backup -> migrate -> switch runtime -> start service -> validate health. No connection or server changes were made.");
    process.exit(0);
  }
  remote('Write-Output "SSH authentication verified"');
  scratch = mkdtempSync(join(tmpdir(), "timemanage-ssh-deploy-"));
  const staging = join(scratch, "payload");
  mkdirSync(staging);
  for (const name of ["web", "server", "RELEASE.txt", "release-contract.json"]) cpSync(join(payload.root, name), join(staging, name), { recursive: true, dereference: false });
  const archive = join(scratch, "payload.zip");
  run("zip", ["-q", "-r", archive, "."], { cwd: staging });
  const request = `$request = @{\r\nArchivePath=${psQuote(`${uploadRoot}/payload.zip`)}\r\nArchiveSha256=${psQuote(hashFile(archive))}\r\nInstallDir=${psQuote(`${config.remoteRoot}/timemanageTeam`)}\r\nReleaseVersion=${psQuote(payload.contract.release_version)}\r\nApiVersion=${payload.contract.api_protocol_version}\r\nSchemaVersion=${payload.contract.database_schema_version}\r\nMinimumClientRelease=${psQuote(payload.contract.minimum_client_release)}\r\nFiles=@(\r\n${payload.files.map((file) => `@{Path=${psQuote(file.path)};Sha256=${psQuote(file.sha256)};Size=${file.size}}`).join("\r\n")}\r\n)\r\n}\r\n`;
  const requestPath = join(scratch, "deployment-request.ps1");
  writeFileSync(requestPath, "\ufeff" + request);
  remote(`$ErrorActionPreference="Stop"; New-Item -ItemType Directory -Path ${psQuote(uploadRoot)} | Out-Null`);
  const uploads = [[archive, "payload.zip"], [requestPath, "deployment-request.ps1"], [join(root, "scripts", "windows", "deploy-team.ps1"), "deploy-team.ps1"]];
  const batch = uploads.map(([local, name]) => `put ${sftpQuote(local)} ${sftpQuote(`/${uploadName}/${name}`)}`).join("\n") + "\n";
  run("sftp", [...sshOptions, "-o", "BatchMode=yes", "-P", String(config.port), "-b", "-", target], { input: batch, stdio: ["pipe", "inherit", "inherit"] });
  remote(`$ErrorActionPreference="Stop"; & ${psQuote(`${uploadRoot}/deploy-team.ps1`)} -RequestPath ${psQuote(`${uploadRoot}/deployment-request.ps1`)}; if (-not $?) { exit 1 }`);
  console.log("Deployment completed and local backend health verified. Server backups and release metadata were retained.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}
