@echo off
setlocal

cd /d "%~dp0"

if not exist "timemanage-sync.exe" (
  echo [TimeManage] timemanage-sync.exe not found in this folder.
  pause
  exit /b 1
)

if not exist "sync.json" (
  echo [TimeManage] sync.json not found.
  pause
  exit /b 1
)

echo [TimeManage] Backing up MySQL database...
"%~dp0timemanage-sync.exe" migrate backup --config "%~dp0sync.json"
if errorlevel 1 (
  echo [TimeManage] Database backup failed.
  pause
  exit /b 1
)

echo [TimeManage] Database backup completed.
pause
