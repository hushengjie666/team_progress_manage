@echo off
setlocal EnableExtensions

for %%I in ("%~dp0.") do set "SCRIPT_DIR=%%~fI"

if exist "%SCRIPT_DIR%\sync\release\timemanage-sync.exe" (
  set "SCRIPT_ROOT=%SCRIPT_DIR%"
  set "SCRIPT_SYNC=%SCRIPT_DIR%\sync"
) else (
  set "SCRIPT_SYNC=%SCRIPT_DIR%"
  for %%I in ("%SCRIPT_SYNC%\..") do set "SCRIPT_ROOT=%%~fI"
)

for %%I in ("%SCRIPT_ROOT%\..") do set "PARENT_DIR=%%~fI"
for %%I in ("%SCRIPT_ROOT%") do set "SCRIPT_ROOT_NAME=%%~nxI"

set "ARG1=%~1"
set "ARG2=%~2"
set "LIVE_ROOT="
set "STAMP="

if not "%ARG2%"=="" (
  set "LIVE_ROOT=%ARG1%"
  set "STAMP=%ARG2%"
) else (
  if not "%ARG1%"=="" (
    if exist "%ARG1%\sync" (
      set "LIVE_ROOT=%ARG1%"
    ) else (
      set "STAMP=%ARG1%"
    )
  )
)

if "%LIVE_ROOT%"=="" if not "%TM_LIVE_ROOT%"=="" set "LIVE_ROOT=%TM_LIVE_ROOT%"
if "%LIVE_ROOT%"=="" if exist "%SCRIPT_DIR%\sync\sync.json" if exist "%SCRIPT_DIR%\sync\timemanage-sync.exe" set "LIVE_ROOT=%SCRIPT_DIR%"
if "%LIVE_ROOT%"=="" if /I "%SCRIPT_ROOT_NAME%"=="timemanageTeam" set "LIVE_ROOT=%SCRIPT_ROOT%"
if "%LIVE_ROOT%"=="" if exist "%PARENT_DIR%\sync\sync.json" if exist "%PARENT_DIR%\web\index.html" set "LIVE_ROOT=%PARENT_DIR%"
if "%LIVE_ROOT%"=="" set "LIVE_ROOT=%PARENT_DIR%\timemanageTeam"
for %%I in ("%LIVE_ROOT%") do set "LIVE_ROOT=%%~fI"

set "LIVE_SYNC=%LIVE_ROOT%\sync"
set "LIVE_WEB=%LIVE_ROOT%\web"
set "LIVE_EXE=%LIVE_SYNC%\timemanage-sync.exe"
set "LIVE_CONFIG=%LIVE_SYNC%\sync.json"
set "LATEST_FILE=%LIVE_SYNC%\rollback\latest.txt"

if "%STAMP%"=="" (
  if not exist "%LATEST_FILE%" (
    echo [TimeManage] No rollback point found.
    echo [TimeManage] Expected %LATEST_FILE%
    if "%TM_NO_PAUSE%"=="" pause
    exit /b 1
  )
  set /p STAMP=<"%LATEST_FILE%"
)

set "ROLLBACK_DIR=%LIVE_SYNC%\rollback\%STAMP%"
set "RESTORE_EXE=%LIVE_EXE%"
if exist "%ROLLBACK_DIR%\restore-tool.exe" set "RESTORE_EXE=%ROLLBACK_DIR%\restore-tool.exe"

echo [TimeManage] Live project folder: %LIVE_ROOT%
echo [TimeManage] Rolling back to: %STAMP%
echo.

if not exist "%ROLLBACK_DIR%" (
  echo [TimeManage] Rollback folder not found: %ROLLBACK_DIR%
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

if not exist "%LIVE_EXE%" (
  echo [TimeManage] timemanage-sync.exe not found in live folder:
  echo [TimeManage]   %LIVE_EXE%
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

if not exist "%ROLLBACK_DIR%\database.sql" (
  echo [TimeManage] Database backup not found: %ROLLBACK_DIR%\database.sql
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

if not exist "%LIVE_CONFIG%" (
  echo [TimeManage] sync.json not found:
  echo [TimeManage]   %LIVE_CONFIG%
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

echo [TimeManage] Stopping backend...
if exist "%LIVE_EXE%" (
  "%LIVE_EXE%" stop >nul 2>nul
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8787" ^| findstr "LISTENING"') do (
  echo [TimeManage] Found process on port 8787: %%P
  taskkill /PID %%P /F >nul 2>nul
)

echo.
echo [TimeManage] Restoring MySQL database...
"%RESTORE_EXE%" migrate restore --config "%LIVE_CONFIG%" --input "%ROLLBACK_DIR%\database.sql"
if errorlevel 1 (
  echo [TimeManage] Database restore failed. Backend was not started.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

if exist "%ROLLBACK_DIR%\timemanage-sync.exe" (
  echo.
  echo [TimeManage] Restoring previous backend binary...
  copy /Y "%ROLLBACK_DIR%\timemanage-sync.exe" "%LIVE_EXE%" >nul
  if errorlevel 1 (
    echo [TimeManage] Backend binary restore failed.
    if "%TM_NO_PAUSE%"=="" pause
    exit /b 1
  )
)

if exist "%ROLLBACK_DIR%\sync.json" (
  copy /Y "%ROLLBACK_DIR%\sync.json" "%LIVE_CONFIG%" >nul
)

if exist "%ROLLBACK_DIR%\web" (
  echo.
  echo [TimeManage] Restoring previous web files...
  if not exist "%LIVE_WEB%" mkdir "%LIVE_WEB%" >nul 2>nul
  robocopy "%ROLLBACK_DIR%\web" "%LIVE_WEB%" /MIR /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 4 (
    echo [TimeManage] Web restore failed.
    if "%TM_NO_PAUSE%"=="" pause
    exit /b 1
  )
)

echo.
echo [TimeManage] Starting backend...
"%LIVE_EXE%" start >nul 2>nul
if errorlevel 1 (
  start "TimeManage Backend" "%LIVE_EXE%" serve --config "%LIVE_CONFIG%"
)

timeout /t 3 /nobreak >nul
echo [TimeManage] Health check URL: http://127.0.0.1:8787/health
powershell -NoProfile -Command "try { $c = (New-Object Net.WebClient).DownloadString('http://127.0.0.1:8787/health'); Write-Host $c } catch { exit 1 }"
if errorlevel 1 (
  echo [TimeManage] Health check failed. Please inspect backend logs.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

echo [TimeManage] Rollback completed.
echo [TimeManage] Live project folder: %LIVE_ROOT%
if "%TM_NO_PAUSE%"=="" pause
