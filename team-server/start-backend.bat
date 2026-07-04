@echo off
setlocal

cd /d "%~dp0"

if not exist "timemanage-team.exe" (
  echo [TimeManage] timemanage-team.exe not found in this folder.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

if not exist "backend.json" (
  echo [TimeManage] backend.json not found.
  if exist "backend.example.json" (
    copy "backend.example.json" "backend.json" >nul
    echo [TimeManage] Created backend.json from backend.example.json.
  )
  echo [TimeManage] Please edit backend.json first, then run this script again.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

echo [TimeManage] Starting backend with backend.json...
echo [TimeManage] Health check URL: http://127.0.0.1:8787/health
echo.

"%~dp0timemanage-team.exe" serve --config "%~dp0backend.json"

echo.
echo [TimeManage] Backend exited.
if "%TM_NO_PAUSE%"=="" pause
