@echo off
setlocal

cd /d "%~dp0"

echo [TimeManage] Stopping backend...

if exist "timemanage-team.exe" (
  "timemanage-team.exe" stop >nul 2>nul
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8787" ^| findstr "LISTENING"') do (
  echo [TimeManage] Found process on port 8787: %%P
  taskkill /PID %%P /F >nul 2>nul
)

echo [TimeManage] Backend stop command completed.
if "%TM_NO_PAUSE%"=="" pause
