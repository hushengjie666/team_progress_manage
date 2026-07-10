@echo off
setlocal
pushd "%~dp0"
"%~dp0timemanage-team.exe" db up --config "%~dp0backend.json"
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
