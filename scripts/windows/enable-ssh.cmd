@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0setup-ssh.ps1""' -Wait -PassThru; exit $p.ExitCode"
if errorlevel 1 pause
