param([Parameter(Mandatory=$true)][string]$RequestPath)
# Windows PowerShell 2.0: no Expand-Archive, Get-FileHash or Invoke-WebRequest.
$ErrorActionPreference = "Stop"
$request = $null
. $RequestPath
$request.ArchivePath = [IO.Path]::GetFullPath($request.ArchivePath)
Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = 16777216

function Get-Sha256([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $hash = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($hash.ComputeHash($stream))).Replace("-", "").ToLowerInvariant() }
  finally { $stream.Dispose(); $hash.Dispose() }
}
function Invoke-Backend([string]$Exe, [string[]]$Arguments) {
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Backend command failed: $($Arguments[0]) $($Arguments[1]) (exit $LASTEXITCODE)" }
}
function Read-Health {
  $http = [Net.HttpWebRequest]::Create("http://127.0.0.1:8787/health")
  $http.Timeout = 3000
  $http.ReadWriteTimeout = 3000
  $response = $http.GetResponse()
  $reader = New-Object IO.StreamReader($response.GetResponseStream())
  try { return $json.DeserializeObject($reader.ReadToEnd()) }
  finally { $reader.Dispose(); $response.Close() }
}
function Wait-BackendHealth {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $health = Read-Health
      if ($health.release_version -eq $request.ReleaseVersion -and $health.api_protocol_version -eq $request.ApiVersion -and $health.database_schema_version -eq $request.SchemaVersion -and $health.minimum_client_release -eq $request.MinimumClientRelease -and $health.database_status -eq "ready") { return }
    } catch { }
    Start-Sleep -Seconds 1
  }
  throw "Backend health does not match the deployed release/API/schema contract."
}

$stopped = $false
$migrationStarted = $false
$originalService = $null
$legacyProcesses = @()
$installDir = [IO.Path]::GetFullPath($request.InstallDir)
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$recoveryDir = Join-Path (Split-Path -Parent $installDir) ("timemanage-recovery-" + $stamp)
$nextDir = $installDir + ".next-" + $stamp
$stageDir = Join-Path (Split-Path -Parent $RequestPath) "extracted"
$config = Join-Path $installDir "server\backend.json"
$activeExe = Join-Path $installDir "server\timemanage-team.exe"
$deploymentLock = $null

try {
  $lockPath = Join-Path (Split-Path -Parent $installDir) "timemanage-deployment.lock"
  $deploymentLock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  if (-not (Test-Path $config -PathType Leaf)) { throw "Existing server/backend.json is required. Initial database credentials cannot be inferred." }
  if (-not (Test-Path $activeExe -PathType Leaf)) { throw "Existing backend executable is missing." }
  if ((Get-Sha256 $request.ArchivePath) -ne $request.ArchiveSha256) { throw "Uploaded archive checksum mismatch." }
  foreach ($path in @($stageDir, $nextDir, $recoveryDir)) { if (Test-Path $path) { throw "Refusing to overwrite existing deployment directory: $path" } }
  $originalService = Get-Service TimeManageTeam -ErrorAction SilentlyContinue
  if ($originalService) {
    $serviceInfo = Get-WmiObject Win32_Service -Filter "Name='TimeManageTeam'"
    $expectedPrefix = '"' + $activeExe + '"'
    if (-not ($serviceInfo.PathName.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase) -or $serviceInfo.PathName.StartsWith($activeExe + " ", [StringComparison]::OrdinalIgnoreCase))) { throw "TimeManageTeam service points to a different installation." }
  } else {
    $legacyProcesses = @(Get-WmiObject Win32_Process -Filter "Name='timemanage-team.exe'" | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $activeExe })
  }
  # Check database access and schema compatibility before stopping the current server.
  Invoke-Backend $activeExe @("db", "status", "--config", $config)
  New-Item -ItemType Directory -Path $stageDir | Out-Null
  $shell = New-Object -ComObject Shell.Application
  $source = $shell.NameSpace([string]$request.ArchivePath)
  $destination = $shell.NameSpace([string]$stageDir)
  if (-not $source -or -not $destination) { throw "Windows compressed-folder extraction is unavailable." }
  $destination.CopyHere($source.Items(), 20)
  $deadline = (Get-Date).AddMinutes(3)
  do {
    $complete = $true
    foreach ($file in $request.Files) {
      $path = Join-Path $stageDir $file.Path
      if (-not (Test-Path $path -PathType Leaf) -or (Get-Item $path).Length -ne $file.Size) { $complete = $false; break }
    }
    if (-not $complete) { Start-Sleep -Milliseconds 250 }
  } while (-not $complete -and (Get-Date) -lt $deadline)
  if (-not $complete) { throw "Archive extraction timed out." }
  foreach ($file in $request.Files) {
    if ((Get-Sha256 (Join-Path $stageDir $file.Path)) -ne $file.Sha256) { throw "Extracted file checksum mismatch: $($file.Path)" }
  }
  if (Test-Path (Join-Path $stageDir "server\backend.json")) { throw "Package contains a production configuration file." }
  New-Item -ItemType Directory -Path $recoveryDir | Out-Null
  New-Item -ItemType Directory -Path $nextDir | Out-Null
  Copy-Item -Recurse -Path (Join-Path $installDir "server") -Destination $nextDir
  Copy-Item -Recurse -Force -Path (Join-Path $stageDir "server\*") -Destination (Join-Path $nextDir "server")
  Copy-Item -Recurse -Path (Join-Path $stageDir "web") -Destination $nextDir
  Copy-Item -Path (Join-Path $stageDir "RELEASE.txt"), (Join-Path $stageDir "release-contract.json") -Destination $nextDir
  $newExe = Join-Path $nextDir "server\timemanage-team.exe"
  Invoke-Backend $newExe @("db", "status", "--config", $config)
  if ($originalService) {
    Stop-Service TimeManageTeam
    (Get-Service TimeManageTeam).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(30))
  }
  foreach ($process in $legacyProcesses) { if ($process.Terminate().ReturnValue -ne 0) { throw "Could not stop the existing console backend." } }
  $stopped = $true
  $backupFile = Join-Path $recoveryDir "database-before-upgrade.sql.gz"
  Invoke-Backend $activeExe @("db", "backup", "--config", $config, "--output", $backupFile)
  $manifestPath = $backupFile + ".json"
  if (-not (Test-Path $manifestPath)) { throw "Database backup manifest is missing." }
  $manifest = $json.DeserializeObject([IO.File]::ReadAllText($manifestPath))
  if ((Get-Item $backupFile).Length -ne $manifest.size_bytes -or (Get-Sha256 $backupFile) -ne $manifest.sha256) { throw "Database backup verification failed." }
  $migrationStarted = $true
  Invoke-Backend $newExe @("db", "up", "--config", $config)
  Invoke-Backend $newExe @("db", "status", "--config", $config)
  Invoke-Backend $newExe @("db", "audit", "--config", $config)
  Move-Item -Path $installDir -Destination (Join-Path $recoveryDir "previous-runtime")
  Move-Item -Path $nextDir -Destination $installDir
  if (-not $originalService) {
    Invoke-Backend $activeExe @("install", "--config", $config)
  }
  Set-Service TimeManageTeam -StartupType Automatic
  Start-Service TimeManageTeam
  Wait-BackendHealth
  # Nginx's existing alias and proxy paths are unchanged, so no reload is needed.
  Write-Host "DEPLOYMENT READY: $($request.ReleaseVersion)"
  Write-Host "Verified database backup and previous runtime: $recoveryDir"
} catch {
  $failure = $_.Exception.Message
  if ($migrationStarted) {
    Stop-Service TimeManageTeam -ErrorAction SilentlyContinue
    Write-Host "Database migration was attempted. Service left stopped; no automatic database restore or downgrade was performed."
    Write-Host "Recovery files: $recoveryDir"
  } elseif ($stopped) {
    if ($originalService) { Start-Service TimeManageTeam -ErrorAction SilentlyContinue }
    elseif ($legacyProcesses.Count -gt 0) { Start-Process $activeExe -WorkingDirectory (Split-Path -Parent $activeExe) -ArgumentList ('serve --config "' + $config + '"') }
  }
  Write-Host ("DEPLOYMENT FAILED: " + $failure)
  exit 1
} finally {
  if ($deploymentLock) { $deploymentLock.Dispose() }
}
