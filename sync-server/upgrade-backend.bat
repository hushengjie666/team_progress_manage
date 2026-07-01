@echo off
setlocal EnableExtensions

for %%I in ("%~dp0.") do set "SCRIPT_DIR=%%~fI"

if exist "%SCRIPT_DIR%\sync\release\timemanage-sync.exe" (
  set "PACKAGE_ROOT=%SCRIPT_DIR%"
  set "PACKAGE_SYNC=%SCRIPT_DIR%\sync"
) else (
  set "PACKAGE_SYNC=%SCRIPT_DIR%"
  for %%I in ("%PACKAGE_SYNC%\..") do set "PACKAGE_ROOT=%%~fI"
)

for %%I in ("%PACKAGE_ROOT%\..") do set "PARENT_DIR=%%~fI"
for %%I in ("%PACKAGE_ROOT%") do set "PACKAGE_NAME=%%~nxI"

set "LIVE_ROOT=%~1"
if "%LIVE_ROOT%"=="" if not "%TM_LIVE_ROOT%"=="" set "LIVE_ROOT=%TM_LIVE_ROOT%"
if "%LIVE_ROOT%"=="" if /I "%PACKAGE_NAME%"=="timemanageTeam" set "LIVE_ROOT=%PACKAGE_ROOT%"
if "%LIVE_ROOT%"=="" if exist "%PARENT_DIR%\sync\sync.json" if exist "%PARENT_DIR%\web\index.html" set "LIVE_ROOT=%PARENT_DIR%"
if "%LIVE_ROOT%"=="" set "LIVE_ROOT=%PARENT_DIR%\timemanageTeam"
for %%I in ("%LIVE_ROOT%") do set "LIVE_ROOT=%%~fI"

set "LIVE_SYNC=%LIVE_ROOT%\sync"
set "LIVE_WEB=%LIVE_ROOT%\web"
set "RELEASE_EXE=%PACKAGE_SYNC%\release\timemanage-sync.exe"
set "PACKAGE_WEB=%PACKAGE_ROOT%\web-release"
if not exist "%PACKAGE_WEB%\index.html" if exist "%PACKAGE_ROOT%\web\index.html" set "PACKAGE_WEB=%PACKAGE_ROOT%\web"
set "LIVE_EXE=%LIVE_SYNC%\timemanage-sync.exe"
set "LIVE_CONFIG=%LIVE_SYNC%\sync.json"
set "TOOL_EXE=%LIVE_EXE%"
if exist "%RELEASE_EXE%" set "TOOL_EXE=%RELEASE_EXE%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "ROLLBACK_DIR=%LIVE_SYNC%\rollback\%STAMP%"
set "LATEST_FILE=%LIVE_SYNC%\rollback\latest.txt"

echo [TimeManage] Release folder: %PACKAGE_ROOT%
echo [TimeManage] Live project folder: %LIVE_ROOT%
echo.

if not exist "%RELEASE_EXE%" (
  echo [TimeManage] Release backend not found:
  echo [TimeManage]   %RELEASE_EXE%
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

if not exist "%PACKAGE_WEB%\index.html" (
  echo [TimeManage] Release web files not found:
  echo [TimeManage]   %PACKAGE_WEB%\index.html
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

if not exist "%LIVE_ROOT%" mkdir "%LIVE_ROOT%" >nul 2>nul
if not exist "%LIVE_SYNC%" mkdir "%LIVE_SYNC%" >nul 2>nul

if not exist "%LIVE_CONFIG%" (
  echo [TimeManage] sync.json not found in live project.
  if exist "%PACKAGE_SYNC%\sync.example.json" (
    copy /Y "%PACKAGE_SYNC%\sync.example.json" "%LIVE_CONFIG%" >nul
    echo [TimeManage] Created: %LIVE_CONFIG%
  )
  echo [TimeManage] Please edit sync.json first, then run this script again.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

mkdir "%ROLLBACK_DIR%" >nul 2>nul

echo [TimeManage] Creating rollback point: %ROLLBACK_DIR%
if exist "%LIVE_EXE%" copy /Y "%LIVE_EXE%" "%ROLLBACK_DIR%\timemanage-sync.exe" >nul
copy /Y "%LIVE_CONFIG%" "%ROLLBACK_DIR%\sync.json" >nul
copy /Y "%RELEASE_EXE%" "%ROLLBACK_DIR%\restore-tool.exe" >nul

(
  echo timestamp=%STAMP%
  echo release_folder=%PACKAGE_ROOT%
  echo live_project_folder=%LIVE_ROOT%
  echo release_exe=%RELEASE_EXE%
  echo live_exe=%LIVE_EXE%
) >"%ROLLBACK_DIR%\upgrade-info.txt"

if exist "%LIVE_WEB%" (
  echo [TimeManage] Backing up current web files...
  robocopy "%LIVE_WEB%" "%ROLLBACK_DIR%\web" /MIR /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 4 (
    echo [TimeManage] Web backup failed.
    if "%TM_NO_PAUSE%"=="" pause
    exit /b 1
  )
)

echo [TimeManage] Stopping existing backend...
if exist "%LIVE_EXE%" (
  "%LIVE_EXE%" stop >nul 2>nul
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8787" ^| findstr "LISTENING"') do (
  echo [TimeManage] Found process on port 8787: %%P
  taskkill /PID %%P /F >nul 2>nul
)

echo.
echo [TimeManage] Backing up MySQL database before upgrade...
"%TOOL_EXE%" migrate status --config "%LIVE_CONFIG%" >"%ROLLBACK_DIR%\migration-status-before.txt" 2>&1
"%TOOL_EXE%" migrate backup --config "%LIVE_CONFIG%" --output "%ROLLBACK_DIR%\database.sql"
if errorlevel 1 (
  echo [TimeManage] Backup failed. Upgrade aborted.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)
echo %STAMP%>"%LATEST_FILE%"

echo.
echo [TimeManage] Installing backend scripts...
copy /Y "%PACKAGE_SYNC%\install-windows-service.ps1" "%LIVE_SYNC%\install-windows-service.ps1" >nul
copy /Y "%PACKAGE_SYNC%\sync.example.json" "%LIVE_SYNC%\sync.example.json" >nul

echo [TimeManage] Installing new backend binary...
copy /Y "%RELEASE_EXE%" "%LIVE_EXE%" >nul
if errorlevel 1 (
  echo [TimeManage] Backend binary install failed.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

echo.
echo [TimeManage] Installing new web files...
if not exist "%LIVE_WEB%" mkdir "%LIVE_WEB%" >nul 2>nul
robocopy "%PACKAGE_WEB%" "%LIVE_WEB%" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 4 (
  echo [TimeManage] Web install failed.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

echo.
echo [TimeManage] Applying database migrations...
"%LIVE_EXE%" migrate up --config "%LIVE_CONFIG%"
if errorlevel 1 (
  echo [TimeManage] Database migration failed. Backend was not started.
  echo [TimeManage] You can run rollback.bat from this release folder.
  echo %STAMP%>"%LATEST_FILE%"
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

echo.
echo [TimeManage] Verifying database migrations...
"%LIVE_EXE%" migrate verify --config "%LIVE_CONFIG%"
if errorlevel 1 (
  echo [TimeManage] Database verification failed. Backend was not started.
  echo [TimeManage] You can run rollback.bat from this release folder.
  echo %STAMP%>"%LATEST_FILE%"
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

"%LIVE_EXE%" migrate status --config "%LIVE_CONFIG%" >"%ROLLBACK_DIR%\migration-status-after.txt" 2>&1
echo %STAMP%>"%LATEST_FILE%"

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
  echo [TimeManage] Health check failed. You can run rollback.bat from this release folder.
  if "%TM_NO_PAUSE%"=="" pause
  exit /b 1
)

echo [TimeManage] Upgrade completed.
echo [TimeManage] Live project folder: %LIVE_ROOT%
echo [TimeManage] Rollback point: %STAMP%
if "%TM_NO_PAUSE%"=="" pause
