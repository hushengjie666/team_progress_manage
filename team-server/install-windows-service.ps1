param(
  [string]$InstallDir = "C:\TimeManage\server",
  [string]$ExePath = ".\bin\timemanage-team.exe",
  [string]$ConfigPath = "C:\TimeManage\server\backend.json"
)

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Force $ExePath (Join-Path $InstallDir "timemanage-team.exe")
if (-not (Test-Path $ConfigPath)) {
  Copy-Item -Force ".\backend.example.json" $ConfigPath
}
& (Join-Path $InstallDir "timemanage-team.exe") install --config $ConfigPath
& (Join-Path $InstallDir "timemanage-team.exe") start
