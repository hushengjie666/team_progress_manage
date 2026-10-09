import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { collectPackageFiles, encodedPowerShell, hashFile, psQuote, sftpQuote, validateClientIp, validateConnection } from "./windows-ssh-common.mjs";

const folders = [];
const temp = () => { const path = mkdtempSync(join(tmpdir(), "tm-ssh-test-")); folders.push(path); return path; };
afterEach(() => { for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true }); });
const contract = { release_version: "0.2.10", api_protocol_version: 2, database_schema_version: 13, minimum_client_release: "0.2.10" };
const fixturePackage = () => {
  const path = temp();
  mkdirSync(join(path, "web"));
  mkdirSync(join(path, "server", "migrations"), { recursive: true });
  for (const name of ["web/index.html", "server/timemanage-team.exe", "server/backend.example.json", "server/DATABASE-OPERATIONS.md", "server/migrations/00013.sql", "RELEASE.txt"]) writeFileSync(join(path, name), name);
  writeFileSync(join(path, "release-contract.json"), JSON.stringify(contract));
  return path;
};

test("quotes PowerShell and SFTP paths without allowing command injection", () => {
  assert.equal(psQuote("a'; exit 9; '"), "'a''; exit 9; '''");
  const source = "Write-Output '中文'";
  assert.equal(Buffer.from(encodedPowerShell(source), "base64").toString("utf16le"), source);
  assert.throws(() => sftpQuote("a\nput /private/key /"));
  assert.equal(sftpQuote('a"b'), '"a\\"b"');
});
test("requires a valid host, local account, port and one source IPv4 address", () => {
  const config = { host: "server.example.test", user: "Administrator", port: 22, remoteRoot: "C:\\Users\\Administrator\\Desktop" };
  assert.equal(validateConnection(config), config);
  for (const patch of [{ host: "-oProxyCommand=bad" }, { user: "user@other-host" }, { port: 65536 }, { remoteRoot: "relative" }]) assert.throws(() => validateConnection({ ...config, ...patch }));
  assert.equal(validateClientIp("203.0.113.8"), "203.0.113.8");
  for (const ip of ["0.0.0.0", "0.0.0.0/0", "203.0.113.8/32", "999.0.0.1", "::1"]) assert.throws(() => validateClientIp(ip));
});
test("collects only the server and web portion of a complete unified package", () => {
  const path = fixturePackage();
  mkdirSync(join(path, "desktop"));
  writeFileSync(join(path, "desktop", "large.app"), "ignored");
  const payload = collectPackageFiles(path);
  assert.deepEqual(payload.contract, contract);
  assert.equal(payload.files.length, 7);
  assert.equal(payload.files.find((file) => file.path === "web/index.html").sha256, hashFile(join(path, "web/index.html")));
  assert.ok(payload.files.every((file) => !file.path.startsWith("desktop/")));
});
test("rejects production credentials, symlinks and incomplete package contents", () => {
  const path = fixturePackage();
  writeFileSync(join(path, "server", "backend.json"), "secret");
  assert.throws(() => collectPackageFiles(path), /backend.json/);
  rmSync(join(path, "server", "backend.json"));
  symlinkSync("index.html", join(path, "web", "alias"));
  assert.throws(() => collectPackageFiles(path), /symlink/);
  rmSync(join(path, "web", "alias"));
  rmSync(join(path, "server", "migrations"), { recursive: true });
  assert.throws(() => collectPackageFiles(path), /migrations/);
});
test("dry-run validates the payload without calling SSH or changing the server", () => {
  const path = fixturePackage();
  const local = temp();
  const keyFile = join(local, "key");
  writeFileSync(keyFile, "local-placeholder");
  const configPath = join(local, "config.json");
  writeFileSync(configPath, JSON.stringify({ host: "invalid.example.test", user: "Administrator", port: 22, keyFile, remoteRoot: "C:\\Users\\Administrator\\Desktop" }));
  const result = spawnSync(process.execPath, ["scripts/deploy-team-ssh.mjs", "--config", configPath, "--package", path, "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No connection or server changes/);
});

const pwsh = process.env.TM_PWSH;
test("SSH installer preserves native error output and rejects authentication-package failure", { skip: !pwsh }, () => {
  const local = temp();
  const scriptPath = join(local, "installer-output.ps1");
  writeFileSync(scriptPath, `
$ErrorActionPreference='Stop'
$t=$null; $e=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile(${psQuote(resolve("scripts/windows/setup-ssh.ps1"))},[ref]$t,[ref]$e)
$function=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-BitviseInstall'},$true)
Invoke-Expression $function.Extent.Text
function Start-Process {
  param($FilePath,$ArgumentList,[switch]$Wait,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
  if ($ArgumentList -ne '-defaultInstance -acceptEULA' -or -not $Wait -or -not $PassThru) { throw 'Unexpected installer arguments' }
  Set-Content $RedirectStandardOutput 'Registering authentication package failed: fixture Windows error'
  Set-Content $RedirectStandardError 'fixture stderr'
  return New-Object PSObject -Property @{ExitCode=$script:code}
}
foreach ($script:code in @(0,16,115,106)) {
  $failed=$false
  try { Invoke-BitviseInstall 'installer with spaces.exe' ${psQuote(local)} }
  catch {
    $failed=$true
    if ($script:code -eq 115 -and $_.Exception.Message -notmatch 'authentication package setup failed') { throw }
    if ($script:code -eq 106 -and $_.Exception.Message -notmatch '106') { throw }
  }
  if ($failed -ne ($script:code -ne 0 -and $script:code -ne 16)) { throw 'Wrong installer success classification' }
}
`);
  const result = spawnSync(pwsh, ["-NoProfile", "-File", scriptPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Registering authentication package failed: fixture Windows error/);
  assert.match(result.stdout, /fixture stderr/);
});

test("single-file SSH diagnosis only invokes installer help and collects a report", { skip: !pwsh }, () => {
  const local = temp();
  const repair = join(local, "diagnostic folder");
  mkdirSync(repair);
  const installer = join(local, "Bitvise-SSH-Server.exe");
  writeFileSync(installer, "installer fixture");
  const source = readFileSync("scripts/windows/diagnose-ssh.cmd", "utf8");
  const body = source.split("\n# POWERSHELL START\n")[1];
  assert.ok(body, "Hybrid command must contain its PowerShell body");
  const scriptPath = join(local, "diagnosis-test.ps1");
  const mocked = body.replace("[Security.Principal.WindowsIdentity]::GetCurrent()", "$script:identity")
    .replace("New-Object Security.Principal.WindowsPrincipal($identity)", "$script:principal")
    .replace("d1407f989d18f4505bf623eb1c33a68cd5c79a483214ebc1ff86bee9821293a6", hashFile(installer));
  writeFileSync(scriptPath, `
$env:TM_SSH_DIAG_SCRIPT=${psQuote(join(repair, "diagnose-ssh.cmd"))}
$env:windir=${psQuote(local)}
$script:identity=New-Object PSObject -Property @{Name='fixture account'}
$script:principal=New-Object PSObject
$script:principal | Add-Member ScriptMethod IsInRole {return $true}
function whoami.exe {param($arg) if ($arg -ne '/priv') {throw 'Unexpected identity query'}; 'fixture privileges'}
function Get-ItemProperty {param($Path) if ($Path -ne 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa') {throw 'Unexpected registry query'}; New-Object PSObject -Property @{'Authentication Packages'=@('msv1_0');RunAsPPL=$null}}
function Get-Acl {param($Path) New-Object PSObject -Property @{Sddl='fixture ACL'}}
function Get-Service {param($Name,$ErrorAction) if ($Name -ne 'BvSshServer') {throw 'Unexpected service query'}}
function Get-EventLog {param($LogName,$After,$EntryType,$Newest,$ErrorAction) New-Object PSObject -Property @{Message='Bitvise fixture event';TimeGenerated='fixture time';Source='Bitvise fixture';EventID=1}}
function Start-Process {
  param($FilePath,$ArgumentList,[switch]$Wait,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
  if ($ArgumentList -ne '-help-codes') {throw 'Diagnosis attempted to install or modify system state'}
  Set-Content $RedirectStandardOutput '115: Authentication package could not be set up'
  Set-Content $RedirectStandardError ''
  New-Object PSObject -Property @{ExitCode=12}
}
${mocked}
`);
  const result = spawnSync(pwsh, ["-NoProfile", "-File", scriptPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /DIAGNOSIS FAILED/);
  assert.match(result.stdout, /DIAGNOSIS COMPLETE/);
  assert.match(readFileSync(join(repair, "ssh-diagnostics.log"), "utf8"), /115: Authentication package/);
});

test("SSH setup resolves a nested repair folder and prefers its own configuration", { skip: !pwsh }, () => {
  const local = temp();
  const bundle = join(local, "TimeManage-SSH-Setup");
  const repair = join(bundle, "TimeManage-SSH-Fix");
  mkdirSync(repair, { recursive: true });
  writeFileSync(join(bundle, "setup-config.ps1"), "@{ClientIp='203.0.113.8'}");
  writeFileSync(join(bundle, "deploy-key.pub"), "public key fixture");
  writeFileSync(join(bundle, "Bitvise-SSH-Server.exe"), "installer fixture");
  const scriptPath = join(local, "directories.ps1");
  writeFileSync(scriptPath, `
$ErrorActionPreference='Stop'
$t=$null; $e=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile(${psQuote(resolve("scripts/windows/setup-ssh.ps1"))},[ref]$t,[ref]$e)
$function=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-SetupDirectory'},$true)
Invoke-Expression $function.Extent.Text
$bundle=${psQuote(bundle)}; $repair=${psQuote(repair)}
if ((Get-SetupDirectory $bundle) -ne $bundle) { throw 'Complete bundle did not resolve' }
$setupDir=Get-SetupDirectory $repair
if ($setupDir -ne $bundle) { throw 'Nested repair did not resolve its parent' }
$options=& (Join-Path $setupDir 'setup-config.ps1')
if ($options.ClientIp -ne '203.0.113.8') { throw 'Parent configuration was not loaded' }
foreach ($name in @('deploy-key.pub','Bitvise-SSH-Server.exe')) {
  if (-not (Test-Path (Join-Path $setupDir $name))) { throw "Missing setup asset: $name" }
}
Set-Content (Join-Path $repair 'setup-config.ps1') "@{ClientIp='203.0.113.9'}"
if ((Get-SetupDirectory $repair) -ne $repair) { throw 'Local configuration must take precedence' }
Remove-Item (Join-Path $repair 'setup-config.ps1')
Remove-Item (Join-Path $bundle 'setup-config.ps1')
try { $null=Get-SetupDirectory $repair; throw 'Missing configuration was accepted' }
catch { if ($_.Exception.Message -notmatch 'setup-config.ps1 is missing') { throw } }
`);
  const result = spawnSync(pwsh, ["-NoProfile", "-File", scriptPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const source = readFileSync("scripts/windows/setup-ssh.ps1", "utf8");
  for (const file of ["setup-config.ps1", "deploy-key.pub", "Bitvise-SSH-Server.exe"]) {
    assert.ok(source.includes(`Join-Path $setupDir "${file}"`), `${file} must use the resolved setup directory`);
  }
});

test("SSH hash helpers work with legacy .NET objects without public Dispose", { skip: !pwsh }, () => {
  const scriptPath = join(temp(), "legacy-hash.ps1");
  writeFileSync(scriptPath, `
$ErrorActionPreference = 'Stop'
Add-Type @'
public class LegacyHash {
  public bool Cleared;
  public bool Fail;
  public byte[] ComputeHash(object input) {
    if (Fail) throw new System.InvalidOperationException("hash failure");
    return new byte[] { 0, 1, 254, 255 };
  }
  public void Clear() { Cleared = true; }
}
public class LegacyStream {
  public bool Closed;
  public void Close() { Closed = true; }
}
'@
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile(${psQuote(resolve("scripts/windows/setup-ssh.ps1"))},[ref]$tokens,[ref]$errors)
foreach ($name in @('Get-Sha256','Get-SshFingerprint')) {
  $function=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
  if (-not $function) { throw "Missing helper: $name" }
  $source=$function.Extent.Text.Replace('[Security.Cryptography.SHA256]::Create()','$script:legacyHash').Replace('[IO.File]::OpenRead($Path)','$script:legacyStream')
  Invoke-Expression $source
}
foreach ($fail in @($false,$true)) {
  $script:legacyHash=New-Object LegacyHash
  $script:legacyStream=New-Object LegacyStream
  $script:legacyHash.Fail=$fail
  try {
    $result=Get-Sha256 'fixture'
    if ($fail -or $result -ne '0001feff') { throw 'Unexpected file hash result' }
  } catch { if (-not $fail -or $_.Exception.Message -notmatch 'hash failure') { throw } }
  if (-not $script:legacyHash.Cleared -or -not $script:legacyStream.Closed) { throw 'File hash resources were not released' }
  $script:legacyHash=New-Object LegacyHash
  $script:legacyHash.Fail=$fail
  try {
    $result=Get-SshFingerprint 'ssh-ed25519 AA== fixture'
    if ($fail -or $result -ne 'AAH+/w') { throw 'Unexpected SSH fingerprint result' }
  } catch { if (-not $fail -or $_.Exception.Message -notmatch 'hash failure') { throw } }
  if (-not $script:legacyHash.Cleared) { throw 'Fingerprint hash was not released' }
}
`);
  const result = spawnSync(pwsh, ["-NoProfile", "-File", scriptPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("SSH setup file hashing and host fingerprint match OpenSSH SHA256", { skip: !pwsh }, () => {
  const local = temp();
  const fixture = join(local, "fixture");
  writeFileSync(fixture, "installer hash fixture");
  const keyPath = join(local, "key");
  assert.equal(spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", keyPath]).status, 0);
  const expected = spawnSync("ssh-keygen", ["-lf", `${keyPath}.pub`, "-E", "sha256"], { encoding: "utf8" }).stdout.split(/\s+/)[1];
  const command = `$t=$null;$e=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile(${psQuote(resolve("scripts/windows/setup-ssh.ps1"))},[ref]$t,[ref]$e);$ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true) | ForEach-Object {Invoke-Expression $_.Extent.Text}; Get-Sha256 ${psQuote(fixture)}; 'SHA256:' + (Get-SshFingerprint (Get-Content ${psQuote(`${keyPath}.pub`)}))`;
  const result = spawnSync(pwsh, ["-NoProfile", "-Command", command], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/), [hashFile(fixture), expected]);
});

test("PowerShell deployment files parse and avoid cmdlets unavailable in PowerShell 2", { skip: !pwsh }, () => {
  const result = spawnSync(pwsh, ["-NoProfile", "-Command", "$failed=$false; Get-ChildItem scripts/windows/*.ps1 | ForEach-Object { $t=$null;$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile($_.FullName,[ref]$t,[ref]$e);if($e.Count){$e;$failed=$true} }; if($failed){exit 1}"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const name of ["setup-ssh.ps1", "deploy-team.ps1"]) {
    const source = readFileSync(`scripts/windows/${name}`, "utf8").replace(/^#.*$/gm, "");
    assert.doesNotMatch(source, /\b(Invoke-WebRequest|Expand-Archive|Get-FileHash|ConvertFrom-Json|Get-NetFirewallRule|New-NetFirewallRule)\b/);
  }
});

for (const scenario of ["success", "archive-failure", "backup-failure", "migration-failure", "health-failure"]) {
  test(`deployment control flow: ${scenario}`, { skip: !pwsh }, () => {
    const payloadDir = fixturePackage();
    const local = temp();
    const installDir = join(local, "runtime");
    const oldServer = join(installDir, "server");
    mkdirSync(oldServer, { recursive: true });
    mkdirSync(join(installDir, "web"));
    writeFileSync(join(oldServer, "backend.json"), "preserve-production-config");
    writeFileSync(join(installDir, "web", "index.html"), "previous web");
    const tracePath = join(local, "trace.txt");
    const backend = `#!/bin/sh\nprintf '%s\\n' "$*" >> "$TM_AUTOMATION_TEST_LOG"\nif [ "$2" = backup ]; then\n  printf 'verified-backup' > "$6"\n  DIGEST=$(shasum -a 256 "$6" | cut -d ' ' -f 1)\n  if [ "$TM_AUTOMATION_TEST_SCENARIO" = backup-failure ]; then DIGEST=bad; fi\n  printf '{"sha256":"%s","size_bytes":15}' "$DIGEST" > "$6.json"\nfi\nif [ "$2" = up ] && [ "$TM_AUTOMATION_TEST_SCENARIO" = migration-failure ]; then exit 42; fi\nexit 0\n`;
    writeFileSync(join(oldServer, "timemanage-team.exe"), backend, { mode: 0o755 });
    writeFileSync(join(payloadDir, "server", "timemanage-team.exe"), backend, { mode: 0o755 });
    chmodSync(join(payloadDir, "server", "timemanage-team.exe"), 0o755);
    const payload = collectPackageFiles(payloadDir);
    const archive = join(local, "payload.zip");
    writeFileSync(archive, "mock archive");
    const requestPath = join(local, "request.ps1");
    writeFileSync(requestPath, `$request=@{ArchivePath=${psQuote(archive)};ArchiveSha256=${psQuote(scenario === "archive-failure" ? "bad" : hashFile(archive))};InstallDir=${psQuote(installDir)};ReleaseVersion='0.2.10';ApiVersion=2;SchemaVersion=13;MinimumClientRelease='0.2.10';Files=@(${payload.files.map((file) => `@{Path=${psQuote(file.path)};Size=${file.size};Sha256=${psQuote(file.sha256)}}`).join(";")})}`);
    const result = spawnSync(pwsh, ["-NoProfile", "-File", "scripts/windows/deploy-team.test.ps1", "-SourcePath", resolve("scripts/windows/deploy-team.ps1"), "-RequestPath", requestPath, "-PayloadPath", payloadDir, "-InstallDir", installDir, "-Scenario", scenario, "-TracePath", tracePath], {
      encoding: "utf8", env: { ...process.env, TM_AUTOMATION_TEST_LOG: tracePath, TM_AUTOMATION_TEST_SCENARIO: scenario },
    });
    const trace = existsSync(tracePath) ? readFileSync(tracePath, "utf8") : "";
    assert.equal(result.status, scenario === "success" ? 0 : 1, result.stdout + result.stderr);
    if (scenario === "success") {
      assert.equal(readFileSync(join(installDir, "server", "backend.json"), "utf8"), "preserve-production-config");
      assert.equal(readFileSync(join(installDir, "web", "index.html"), "utf8"), "web/index.html");
      assert.match(trace, /stop[\s\S]*db backup[\s\S]*db up[\s\S]*db audit[\s\S]*start/);
    } else if (scenario === "archive-failure") assert.doesNotMatch(trace, /stop|db up/);
    else if (scenario === "backup-failure") { assert.doesNotMatch(trace, /db up/); assert.match(trace, /start/); }
    else { assert.match(result.stdout, /Service left stopped/); assert.match(trace.trim(), /stop$/); }
  });
}
