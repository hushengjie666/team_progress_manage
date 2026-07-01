@echo off
setlocal

cd /d "%~dp0"

if not exist "timemanage-sync.exe" (
  echo [TimeManage] timemanage-sync.exe not found in this folder.
  if exist "%~dp0release\timemanage-sync.exe" (
    echo [TimeManage] Found release\timemanage-sync.exe.
    echo [TimeManage] Please run ..\upgrade.bat first to install this release.
  )
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

if not exist "sync.json" (
  echo [TimeManage] sync.json not found.
  if exist "sync.example.json" (
    copy "sync.example.json" "sync.json" >nul
    echo [TimeManage] Created sync.json from sync.example.json.
  )
  echo [TimeManage] Please edit sync.json first, then run this script again.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

echo [TimeManage] Starting backend with sync.json...
echo [TimeManage] Health check URL: http://127.0.0.1:8787/health
echo.

"%~dp0timemanage-sync.exe" serve --config "%~dp0sync.json"

echo.
echo [TimeManage] Backend exited.
if "%TM_NO_PAUSE%"=="" pause
