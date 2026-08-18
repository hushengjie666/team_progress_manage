@echo off
setlocal
if "%~1"=="" (
  echo Usage: restore-database.bat backups\timemanage-db-^<version^>-yyyyMMdd-HHmmss.sql.gz
  exit /b 2
)
pushd "%~dp0"
"%~dp0timemanage-team.exe" stop >nul 2>nul
"%~dp0timemanage-team.exe" db restore --config "%~dp0backend.json" --file "%~1" --confirm
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
