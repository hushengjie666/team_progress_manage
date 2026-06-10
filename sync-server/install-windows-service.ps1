param(
  [string]$InstallDir = "C:\TimeManage\sync",
  [string]$ExePath = ".\bin\timemanage-sync.exe",
  [string]$ConfigPath = "C:\TimeManage\sync\sync.json"
)

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Force $ExePath (Join-Path $InstallDir "timemanage-sync.exe")
if (-not (Test-Path $ConfigPath)) {
  Copy-Item -Force ".\config.example.json" $ConfigPath
}
& (Join-Path $InstallDir "timemanage-sync.exe") install --config $ConfigPath
& (Join-Path $InstallDir "timemanage-sync.exe") start

