@echo off
setlocal
if "%~1"=="" (
  echo Usage: rollback-database.bat v0.1.2
  exit /b 2
)
pushd "%~dp0"
"%~dp0timemanage-team.exe" stop >nul 2>nul
"%~dp0timemanage-team.exe" db rollback --config "%~dp0backend.json" --to "%~1" --confirm
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
